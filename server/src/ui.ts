// The web UI is static files, built from ../web into public/_/ and served by the assets binding.
// Every request reaches the Worker first (run_worker_first in wrangler.jsonc), so by the time it
// gets here it has been signed in like any other. This only adds the headers the files need.
import type { Env } from "./types";

// Vite emits no inline scripts or styles and no data: URLs, so everything can be 'self'.
const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "font-src 'self'",
  "img-src 'self'",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
].join("; ");

export async function serveUi(req: Request, env: Env): Promise<Response> {
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
  const res = await env.ASSETS.fetch(req);
  const out = new Response(res.body, res);
  // Files under /_/assets/ have a content hash in their names, so they never change; the page
  // that names them must be checked every time.
  const hashed = res.ok && new URL(req.url).pathname.startsWith("/_/assets/");
  // private: everything sits behind sign-in, so shared caches must not keep it.
  out.headers.set("cache-control", hashed ? "private, max-age=31536000, immutable" : "private, no-cache");
  out.headers.set("content-security-policy", CSP);
  out.headers.set("x-content-type-options", "nosniff");
  out.headers.set("referrer-policy", "same-origin");
  return out;
}
