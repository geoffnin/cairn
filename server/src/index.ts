import { handleApi } from "./api";
import { AuthError, authenticate, handleCallback, handleLogin, handleLogout, mode } from "./auth";
import { handleExtensionConnect, handleExtensionDone, handleExtensionToken } from "./extauth";
import { lookupTarget, recordClick, resolveTarget } from "./links";
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
  // Public, so the extension can learn the prefix and sign-in method before anyone is signed in.
  if (path === "/_/config") {
    return json({ name: "Cairn", prefix: linkPrefix(env), auth: mode(env) }, 200, { "access-control-allow-origin": "*" });
  }
  if (path === "/_/auth/extension/token") return handleExtensionToken(req, env);
  if (path === "/_/auth/extension/done") return handleExtensionDone();
  if (path === "/_/auth/login") return handleLogin(req, env);
  if (path === "/_/auth/callback") return handleCallback(req, env);
  if (path === "/_/auth/logout") return handleLogout(req, env);

  const isApi = path.startsWith("/_/api/");
  const user = await authenticate(req, env);
  if (!user) {
    if (isApi) return json({ error: "Not signed in.", login: "/_/auth/login" }, 401);
    return redirect(`/_/auth/login?rd=${encodeURIComponent(path + url.search)}`);
  }

  if (isApi) return handleApi(req, env, user, path.slice("/_/api".length));
  if (path === "/" || path === "/_") return redirect("/_/");
  if (path === "/_/auth/extension") return handleExtensionConnect(req, env, user);
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
  if (target === null) return redirect(`/_/?new=${encodeURIComponent(slug)}`);
  recordClick(env, ctx, slug);
  return redirect(resolveTarget(target, rest, url.search));
}

export default {
  async fetch(req, env, ctx): Promise<Response> {
    try {
      return await route(req, env, ctx);
    } catch (e) {
      if (e instanceof AuthError) return new Response(e.message, { status: e.status, headers: { "cache-control": "no-store" } });
      console.error(e);
      return new Response("Internal error", { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;
