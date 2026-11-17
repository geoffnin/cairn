// JSON API under /_/api. All routes require an authenticated user (enforced by the router).
import {
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

export async function handleApi(req: Request, env: Env, user: User, path: string): Promise<Response> {
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
          owner: p.get("owner") === "me" ? user.email : undefined,
          limit: Number(p.get("limit")) || undefined,
        });
        return json({ links: links.map((l) => present(env, user, l)) });
      }
      if (req.method === "POST") {
        const b = await body(req);
        const slug = normalizeSlug(b.slug);
        const link = await createLink(env, {
          slug,
          url: validateUrl(b.url),
          description: validateDescription(b.description),
          owner: user.email,
        });
        if (!link) return json({ error: `go/${slug} already exists.` }, 409);
        logEvent(linkCreated(req, user.email, slug, link));
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

      if (req.method === "PUT") {
        const b = await body(req);
        const updated = await updateLink(env, slug, {
          url: b.url === undefined ? link.url : validateUrl(b.url),
          description: b.description === undefined ? link.description : validateDescription(b.description),
          owner: b.owner === undefined ? link.owner : validateOwner(b.owner),
        });
        logEvent(linkUpdated(req, user.email, slug, link, updated!));
        return json(present(env, user, updated!));
      }
      if (req.method === "DELETE") {
        await deleteLink(env, slug);
        logEvent(linkDeleted(req, user.email, slug, link));
        return json({ ok: true });
      }
    }
    return json({ error: "Not found." }, 404);
  } catch (e) {
    if (e instanceof ValidationError || e instanceof URIError) return json({ error: e.message }, 400);
    throw e;
  }
}
