// Link storage (D1) with a two-level read cache for the redirect hot path:
//   L1  per-isolate memory, 30s TTL   - free, absorbs bursts
//   L2  Workers KV, written through   - edge-local reads, no D1 round trip
//   L3  D1                            - source of truth
import type { Env, Link } from "./types";
import { nowSeconds } from "./util";

export const PLACEHOLDER = "{*}";
const SLUG_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const MEM_TTL_MS = 30_000;
const MEM_MAX = 2000;
const KV_TTL_S = 7 * 24 * 3600;

export class ValidationError extends Error {}

export function normalizeSlug(raw: unknown): string {
  const slug = String(raw ?? "").trim().toLowerCase();
  if (!SLUG_RE.test(slug)) {
    throw new ValidationError("Name must be 1-64 characters: letters, digits, '-', '_' or '.', starting with a letter or digit.");
  }
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
  if (!rest && search.length <= 1) return out;
  const url = new URL(out);
  if (rest) url.pathname = `${url.pathname.replace(/\/$/, "")}/${rest}`;
  for (const [k, v] of new URLSearchParams(search)) url.searchParams.append(k, v);
  return url.toString();
}

// ---- cache ----

const mem = new Map<string, { url: string | null; exp: number }>();

function memSet(slug: string, url: string | null): void {
  if (mem.size >= MEM_MAX) mem.delete(mem.keys().next().value!);
  mem.set(slug, { url, exp: Date.now() + MEM_TTL_MS });
}

async function kvSet(env: Env, slug: string, url: string | null): Promise<void> {
  try {
    if (url === null) await env.CACHE.delete(`l:${slug}`);
    else await env.CACHE.put(`l:${slug}`, url, { expirationTtl: KV_TTL_S });
  } catch (e) {
    // The cache is an optimisation; never fail a request because of it (e.g. KV daily write quota).
    console.warn("cache write failed", slug, e);
  }
}

/** Redirect hot path: slug -> target URL, or null if there is no such link. */
export async function lookupTarget(env: Env, ctx: ExecutionContext, slug: string): Promise<string | null> {
  const hit = mem.get(slug);
  if (hit && hit.exp > Date.now()) return hit.url;

  let url: string | null = null;
  try {
    url = await env.CACHE.get(`l:${slug}`);
  } catch (e) {
    console.warn("cache read failed", slug, e);
  }
  if (url === null) {
    const row = await env.DB.prepare("SELECT url FROM links WHERE slug = ?").bind(slug).first<{ url: string }>();
    url = row?.url ?? null;
    // Misses are cached in memory only: keeps KV writes (the scarce free-tier resource) for real links.
    if (url !== null) ctx.waitUntil(kvSet(env, slug, url));
  }
  memSet(slug, url);
  return url;
}

/** Keeps the usage count shown in the UI. Runs after the response has gone out. */
export function recordClick(env: Env, ctx: ExecutionContext, slug: string): void {
  ctx.waitUntil(
    env.DB.prepare("UPDATE links SET clicks = clicks + 1, last_clicked_at = ? WHERE slug = ?")
      .bind(nowSeconds(), slug)
      .run()
      .catch((e) => console.warn("click count failed", slug, e)),
  );
}

// ---- CRUD ----

export function getLink(env: Env, slug: string): Promise<Link | null> {
  return env.DB.prepare("SELECT * FROM links WHERE slug = ?").bind(slug).first<Link>();
}

export async function listLinks(env: Env, opts: { q?: string; owner?: string; limit?: number }): Promise<Link[]> {
  const where: string[] = [];
  const args: unknown[] = [];
  if (opts.q) {
    const like = `%${opts.q.toLowerCase().replace(/[\\%_]/g, "\\$&")}%`;
    where.push("(slug LIKE ? ESCAPE '\\' OR lower(url) LIKE ? ESCAPE '\\' OR lower(description) LIKE ? ESCAPE '\\')");
    args.push(like, like, like);
  }
  if (opts.owner) {
    where.push("owner = ?");
    args.push(opts.owner);
  }
  const sql = `SELECT * FROM links ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY slug LIMIT ?`;
  const { results } = await env.DB.prepare(sql)
    .bind(...args, Math.min(opts.limit ?? 500, 500))
    .all<Link>();
  return results;
}

/** Returns null if the slug is already taken. */
export async function createLink(
  env: Env,
  link: Pick<Link, "slug" | "url" | "description" | "owner">,
): Promise<Link | null> {
  const now = nowSeconds();
  const res = await env.DB.prepare(
    "INSERT INTO links (slug, url, description, owner, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (slug) DO NOTHING",
  )
    .bind(link.slug, link.url, link.description, link.owner, now, now)
    .run();
  if (!res.meta.changes) return null;
  memSet(link.slug, link.url);
  await kvSet(env, link.slug, link.url);
  return getLink(env, link.slug);
}

export async function updateLink(
  env: Env,
  slug: string,
  patch: Pick<Link, "url" | "description" | "owner">,
): Promise<Link | null> {
  await env.DB.prepare("UPDATE links SET url = ?, description = ?, owner = ?, updated_at = ? WHERE slug = ?")
    .bind(patch.url, patch.description, patch.owner, nowSeconds(), slug)
    .run();
  memSet(slug, patch.url);
  await kvSet(env, slug, patch.url);
  return getLink(env, slug);
}

export async function deleteLink(env: Env, slug: string): Promise<void> {
  await env.DB.prepare("DELETE FROM links WHERE slug = ?").bind(slug).run();
  memSet(slug, null);
  await kvSet(env, slug, null);
}

export function _resetMemCache(): void {
  mem.clear();
}
