// Link storage (D1) with a two-level read cache for the redirect hot path:
//   L1  per-isolate memory  - free, absorbs bursts; REDIRECT_CACHE_SECONDS (default 30)
//   L2  Workers KV          - edge-local reads, no D1 round trip
//   L3  D1                  - source of truth
//
// KV is written only by link changes, never by lookups. A lookup that wrote what it had just
// read from D1 could land after a concurrent edit had updated KV and put the old destination
// back. Changes clear the KV entry before touching D1 (and refuse to proceed if they cannot),
// then write the new value; a missing entry just means reads go to D1.
import { inSpan } from "./tracing";
import type { Env, Link } from "./types";
import { nowSeconds } from "./util";

export const PLACEHOLDER = "{*}";
const SLUG_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;

/** Placeholder recorded instead of a requested name that could never be a link. */
export const INVALID_SLUG = "(invalid)";

/**
 * The link name as it may appear in logs and traces: the name if it is valid link syntax, else a
 * fixed placeholder. Visitors can request any path (go/alice@example.com), and recording it
 * verbatim would put arbitrary text, emails included, into telemetry.
 */
export function slugForTelemetry(slug: string): string {
  return SLUG_RE.test(slug) ? slug : INVALID_SLUG;
}
const DEFAULT_CACHE_SECONDS = 30;
const MAX_CACHE_SECONDS = 3600;
/** Unknown names are remembered briefly, so a link someone just created shows up quickly. */
const MISS_CACHE_SECONDS = 5;
const MEM_MAX = 2000;

export class ValidationError extends Error {}
/** The redirect cache could not be cleared, so changing the link now could leave it stale. */
export class CacheUnavailableError extends Error {}

/** Paths the router answers itself, so links with these names could never be followed. */
const RESERVED = new Set(["robots.txt", "favicon.ico"]);

export function normalizeSlug(raw: unknown): string {
  const slug = String(raw ?? "").trim().toLowerCase();
  if (!SLUG_RE.test(slug)) {
    throw new ValidationError("Name must be 1-64 characters: letters, digits, '-', '_' or '.', starting with a letter or digit.");
  }
  if (RESERVED.has(slug)) throw new ValidationError(`go/${slug} is reserved.`);
  return slug;
}

export function validateUrl(raw: unknown): string {
  const url = String(raw ?? "").trim();
  if (!url || url.length > 2048) throw new ValidationError("URL is required (max 2048 characters).");
  let parsed: URL;
  try {
    parsed = new URL(url.replaceAll(PLACEHOLDER, "x"));
  } catch {
    throw new ValidationError("URL is not valid. Include the scheme, e.g. https://example.com/page");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new ValidationError("Only http:// and https:// URLs are allowed.");
  }
  return url;
}

export function validateDescription(raw: unknown): string {
  const d = String(raw ?? "").trim();
  if (d.length > 500) throw new ValidationError("Description is too long (max 500 characters).");
  return d;
}

/**
 * Build the final destination for `go/<slug>/<rest>?<query>`.
 * - `{*}` in the target is replaced by <rest> (URL-encoded when it lands in the query string).
 * - Without a placeholder, <rest> is appended to the target's path.
 * - Request query parameters are appended to the target's.
 */
export function resolveTarget(target: string, rest: string, search: string): string {
  let out = target;
  if (target.includes(PLACEHOLDER)) {
    const q = target.indexOf("?");
    let decoded = rest;
    try {
      decoded = decodeURIComponent(rest);
    } catch {
      /* keep raw */
    }
    const forQuery = encodeURIComponent(decoded);
    out = target.replaceAll(PLACEHOLDER, (_m, offset: number) => (q !== -1 && offset > q ? forQuery : rest));
    rest = "";
  }
  // Always serialize through URL: it completes forms like "https:example.com" and percent-encodes
  // non-ASCII characters, which a Location header cannot carry.
  const url = new URL(out);
  if (rest) url.pathname = `${url.pathname.replace(/\/$/, "")}/${rest}`;
  for (const [k, v] of new URLSearchParams(search)) url.searchParams.append(k, v);
  return url.href;
}

// ---- cache ----

const mem = new Map<string, { url: string | null; exp: number }>();

/** How long this isolate trusts a cached redirect: REDIRECT_CACHE_SECONDS, 0-3600, default 30. */
export function cacheSeconds(env: Env): number {
  const raw = env.REDIRECT_CACHE_SECONDS?.trim();
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.min(Math.floor(n), MAX_CACHE_SECONDS) : DEFAULT_CACHE_SECONDS;
}

function memSet(env: Env, slug: string, url: string | null): void {
  const ttl = url === null ? Math.min(MISS_CACHE_SECONDS, cacheSeconds(env)) : cacheSeconds(env);
  if (ttl === 0) {
    mem.delete(slug);
    return;
  }
  if (mem.size >= MEM_MAX && !mem.has(slug)) mem.delete(mem.keys().next().value!);
  mem.set(slug, { url, exp: Date.now() + ttl * 1000 });
}

/** Before a change: remove the cached destination, or refuse the change. */
async function kvClear(env: Env, slug: string): Promise<void> {
  try {
    await env.CACHE.delete(`l:${slug}`);
  } catch (e) {
    console.error("cache clear failed", slug, e);
    throw new CacheUnavailableError("The redirect cache is unavailable, so the link was not changed. Try again later.");
  }
}

/** After a change: cache the new destination. If this fails, reads simply go to D1. */
async function kvFill(env: Env, slug: string, url: string): Promise<void> {
  try {
    await env.CACHE.put(`l:${slug}`, url);
  } catch (e) {
    console.warn("cache write failed", slug, e);
  }
}

const newRev = () => crypto.randomUUID();

/** Redirect hot path: slug -> target URL, or null if there is no such link. */
export function lookupTarget(env: Env, slug: string): Promise<string | null> {
  // cache.layer says which layer answered: the main performance signal for redirects.
  return inSpan("cairn.link.lookup", { "link.slug": slugForTelemetry(slug) }, async (span) => {
    const answer = (layer: "memory" | "kv" | "d1", url: string | null) => {
      span.setAttributes({ "cache.layer": layer, "link.found": url !== null });
      return url;
    };
    const hit = mem.get(slug);
    if (hit && hit.exp > Date.now()) return answer("memory", hit.url);

    let url: string | null = null;
    try {
      url = await env.CACHE.get(`l:${slug}`);
    } catch (e) {
      console.warn("cache read failed", slug, e);
      span.setAttribute("cache.kv_error", true);
    }
    const layer = url === null ? "d1" : "kv";
    if (url === null) {
      // Not written back to KV: see the note at the top of this file.
      const row = await env.DB.prepare("SELECT url FROM links WHERE slug = ?").bind(slug).first<{ url: string }>();
      url = row?.url ?? null;
    }
    memSet(env, slug, url);
    return answer(layer, url);
  });
}

// ---- CRUD ----

// Links with the owner's email joined in from users, the only table that stores emails. The
// leftover links.owner column (see migration 0007) is never read or written.
const SELECT_LINKS =
  "SELECT l.slug, l.url, l.description, l.owner_id, l.created_at, l.updated_at, l.rev, " +
  "COALESCE(u.email, '') AS owner FROM links l LEFT JOIN users u ON u.id = l.owner_id";

export function getLink(env: Env, slug: string): Promise<Link | null> {
  return env.DB.prepare(`${SELECT_LINKS} WHERE l.slug = ?`).bind(slug).first<Link>();
}

export async function listLinks(env: Env, opts: { q?: string; ownerId?: string; limit?: number }): Promise<Link[]> {
  const where: string[] = [];
  const args: unknown[] = [];
  if (opts.q) {
    const like = `%${opts.q.toLowerCase().replace(/[\\%_]/g, "\\$&")}%`;
    where.push("(l.slug LIKE ? ESCAPE '\\' OR lower(l.url) LIKE ? ESCAPE '\\' OR lower(l.description) LIKE ? ESCAPE '\\')");
    args.push(like, like, like);
  }
  if (opts.ownerId) {
    where.push("l.owner_id = ?");
    args.push(opts.ownerId);
  }
  // SQLite treats a negative LIMIT as "no limit", so clamp to a whole number in 1-500.
  const limit = opts.limit !== undefined && Number.isFinite(opts.limit) ? Math.min(Math.max(Math.trunc(opts.limit), 1), 500) : 500;
  const sql = `${SELECT_LINKS} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY l.slug LIMIT ?`;
  const { results } = await env.DB.prepare(sql)
    .bind(...args, limit)
    .all<Link>();
  return results;
}

/** Returns null if the slug is already taken. */
export async function createLink(
  env: Env,
  link: Pick<Link, "slug" | "url" | "description" | "owner_id">,
): Promise<Link | null> {
  const now = nowSeconds();
  const res = await env.DB.prepare(
    "INSERT INTO links (slug, url, description, owner_id, created_at, updated_at, rev) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (slug) DO NOTHING",
  )
    .bind(link.slug, link.url, link.description, link.owner_id, now, now, newRev())
    .run();
  if (!res.meta.changes) return null;
  memSet(env, link.slug, link.url);
  await kvFill(env, link.slug, link.url);
  return getLink(env, link.slug);
}

/** Applies the change only if the link is still at `rev`. Returns null if it has changed since. */
export async function updateLink(
  env: Env,
  slug: string,
  rev: string,
  patch: Pick<Link, "url" | "description" | "owner_id">,
): Promise<Link | null> {
  await kvClear(env, slug);
  const res = await env.DB.prepare(
    "UPDATE links SET url = ?, description = ?, owner_id = ?, updated_at = ?, rev = ? WHERE slug = ? AND rev = ?",
  )
    .bind(patch.url, patch.description, patch.owner_id, nowSeconds(), newRev(), slug, rev)
    .run();
  if (!res.meta.changes) {
    mem.delete(slug);
    return null;
  }
  memSet(env, slug, patch.url);
  await kvFill(env, slug, patch.url);
  return getLink(env, slug);
}

/** Deletes the link only if it is still at `rev`. Returns false if it has changed since. */
export async function deleteLink(env: Env, slug: string, rev: string): Promise<boolean> {
  await kvClear(env, slug);
  const res = await env.DB.prepare("DELETE FROM links WHERE slug = ? AND rev = ?").bind(slug, rev).run();
  mem.delete(slug);
  return res.meta.changes > 0;
}

export function _resetMemCache(): void {
  mem.clear();
}
