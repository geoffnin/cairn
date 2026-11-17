import { handleApi } from "./api";
import { AuthError, authenticate, handleLogout, mode } from "./auth";
import { clickEvent, logEvent } from "./events";
import { lookupTarget, resolveTarget } from "./links";
import type { Env } from "./types";
import { renderUi } from "./ui";
import { json, linkPrefix, redirect } from "./util";

// Everything that is not a go link lives under /_/ ("_" can never start a link name).
async function route(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  if (path === "/_/healthz") return new Response("ok");
  if (path === "/robots.txt") return new Response("User-agent: *\nDisallow: /\n");
  if (path === "/favicon.ico") return new Response(null, { status: 204 });
  // Meant to be public, so the extension can learn the prefix before anyone signs in. Behind
  // Access that needs a Bypass policy for this path; see the README.
  if (path === "/_/config") {
    return json({ name: "Cairn", prefix: linkPrefix(env), auth: mode(env) }, 200, { "access-control-allow-origin": "*" });
  }
  if (path === "/_/auth/logout") return handleLogout(req, env);

  const user = await authenticate(req, env);
  if (path.startsWith("/_/api/")) return handleApi(req, env, user, path.slice("/_/api".length));
  if (path === "/" || path === "/_") return redirect("/_/");
  if (path === "/_/") return renderUi(linkPrefix(env));
  if (path.startsWith("/_/")) return new Response("Not found", { status: 404 });

  // <prefix>/<slug>[/<rest>]
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
  const cut = path.indexOf("/", 1);
  const rawSlug = cut === -1 ? path.slice(1) : path.slice(1, cut);
  const rest = cut === -1 ? "" : path.slice(cut + 1);
  let slug: string;
  try {
    slug = decodeURIComponent(rawSlug).toLowerCase();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const target = await lookupTarget(env, ctx, slug);
  if (target === null) {
    logEvent(clickEvent(req, slug, false, null, rest !== ""));
    return redirect(`/_/?new=${encodeURIComponent(slug)}`);
  }
  const destination = resolveTarget(target, rest, url.search);
  // Usage is counted from this event in your metrics platform, not in D1 (decision D18).
  logEvent(clickEvent(req, slug, true, destination, rest !== ""));
  return redirect(destination);
}

export default {
  async fetch(req, env, ctx): Promise<Response> {
    try {
      return await route(req, env, ctx);
    } catch (e) {
      if (e instanceof AuthError) {
        if (new URL(req.url).pathname.startsWith("/_/api/")) return json({ error: e.message }, e.status);
        return new Response(e.message, { status: e.status, headers: { "cache-control": "no-store" } });
      }
      console.error(e);
      return new Response("Internal error", { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;
