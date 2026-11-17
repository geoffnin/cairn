// JSON API under /_/api. All routes require an authenticated user (enforced by the router).
import {
  CacheUnavailableError,
  ValidationError,
  createLink,
  deleteLink,
  getLink,
  listLinks,
  normalizeSlug,
  updateLink,
  validateDescription,
  validateUrl,
} from "./links";
import type { Env, Link, User } from "./types";
import { linkCreated, linkDeleted, linkUpdated, logEvent, metricsUrl } from "./events";
import { inSpan } from "./tracing";
import { userIdFor } from "./users";
import { json } from "./util";

const canEdit = (user: User, link: Link) => user.isAdmin || link.owner === user.email;
const present = (env: Env, user: User, link: Link) => ({
  ...link,
  can_edit: canEdit(user, link),
  metrics_url: metricsUrl(env, link.slug),
});

/**
 * CSRF defence for cookie-authenticated writes. The custom header cannot be sent cross-origin
 * without a CORS preflight, which this server never approves; the Origin check is belt and braces.
 * Extensions granted host access to this server are exempt from CORS and are allowed.
 */
function checkCsrf(req: Request): Response | null {
  if (req.headers.get("x-cairn-request") !== "1") return json({ error: "Missing X-Cairn-Request header." }, 403);
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin && !origin.startsWith("chrome-extension://")) {
    return json({ error: "Cross-origin request refused." }, 403);
  }
  return null;
}

async function body(req: Request): Promise<Record<string, unknown>> {
  try {
    const b = await req.json();
    if (b && typeof b === "object" && !Array.isArray(b)) return b as Record<string, unknown>;
  } catch {
    /* fall through */
  }
  throw new ValidationError("Request body must be a JSON object.");
}

function validateOwner(raw: unknown): string {
  const owner = String(raw ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+$/.test(owner) || owner.length > 254) throw new ValidationError("Owner must be an email address.");
  return owner;
}

export function handleApi(req: Request, env: Env, user: User, path: string): Promise<Response> {
  // Route with the link name replaced, so spans group by operation, not by link.
  const route = path.replace(/^\/links\/[^/]+$/, "/links/:slug");
  return inSpan("cairn.api", { "http.method": req.method, "cairn.api.route": route }, async (span) => {
    const res = await apiRoute(req, env, user, path);
    span.setAttribute("http.status_code", res.status);
    return res;
  });
}

async function apiRoute(req: Request, env: Env, user: User, path: string): Promise<Response> {
  const write = req.method !== "GET" && req.method !== "HEAD";
  if (write) {
    const denied = checkCsrf(req);
    if (denied) return denied;
  }
  try {
    if (path === "/me" && !write) return json(user);

    if (path === "/links") {
      if (!write) {
        const p = new URL(req.url).searchParams;
        const links = await listLinks(env, {
          q: p.get("q")?.trim() || undefined,
          ownerId: p.get("owner") === "me" ? await userIdFor(env, user.email) : undefined,
          limit: p.get("limit") ? Number(p.get("limit")) : undefined,
        });
        return json({ links: links.map((l) => present(env, user, l)) });
      }
      if (req.method === "POST") {
        const b = await body(req);
        const slug = normalizeSlug(b.slug);
        const url = validateUrl(b.url);
        const description = validateDescription(b.description);
        const actorId = await userIdFor(env, user.email);
        const link = await createLink(env, { slug, url, description, owner_id: actorId });
        if (!link) return json({ error: `go/${slug} already exists.` }, 409);
        logEvent(linkCreated(req, actorId, slug, link));
        return json(present(env, user, link), 201);
      }
    }

    const m = /^\/links\/([^/]+)$/.exec(path);
    if (m) {
      const slug = normalizeSlug(decodeURIComponent(m[1]!));
      const link = await getLink(env, slug);
      if (!link) return json({ error: `go/${slug} does not exist.` }, 404);
      if (!write) return json(present(env, user, link));
      if (!canEdit(user, link)) return json({ error: `Only ${link.owner} or an admin can change go/${slug}.` }, 403);

      // Optional optimistic concurrency for clients: the rev they last saw (body for PUT,
      // ?rev= for DELETE). Independently, the write itself is conditional on the rev that was
      // checked above, so nothing that changed in between can be overwritten.
      const stale = () => json({ error: `go/${slug} was changed by someone else. Reload and try again.` }, 409);

      // Resolved before changing anything, so a failure here cannot follow a committed change
      // and lose its event.
      const actorId = await userIdFor(env, user.email);

      if (req.method === "PUT") {
        const b = await body(req);
        if (b.rev !== undefined && b.rev !== link.rev) return stale();
        const url = b.url === undefined ? link.url : validateUrl(b.url);
        const description = b.description === undefined ? link.description : validateDescription(b.description);
        // Handing a link to someone who has never signed in gives them an ID now.
        const ownerId = b.owner === undefined ? link.owner_id : await userIdFor(env, validateOwner(b.owner));
        const updated = await updateLink(env, slug, link.rev, { url, description, owner_id: ownerId });
        if (!updated) return stale();
        logEvent(linkUpdated(req, actorId, slug, link, updated));
        return json(present(env, user, updated));
      }
      if (req.method === "DELETE") {
        const expected = new URL(req.url).searchParams.get("rev");
        if (expected !== null && expected !== link.rev) return stale();
        if (!(await deleteLink(env, slug, link.rev))) return stale();
        logEvent(linkDeleted(req, actorId, slug, link));
        return json({ ok: true });
      }
    }
    return json({ error: "Not found." }, 404);
  } catch (e) {
    if (e instanceof ValidationError || e instanceof URIError) return json({ error: e.message }, 400);
    if (e instanceof CacheUnavailableError) return json({ error: e.message }, 503);
    throw e;
  }
}
