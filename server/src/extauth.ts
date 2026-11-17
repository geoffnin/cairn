// One-time sign-in for the browser extension (AUTH_MODE=oidc).
//
//   1. The extension opens  GET /_/auth/extension?challenge=<SHA-256 of a secret it keeps>.
//      The person signs in through the normal OIDC flow if they have not already.
//   2. They confirm on a consent page (POST), and land on /_/auth/extension/done#code=<code>.
//   3. The extension reads the code from that tab and swaps it, together with its secret, for
//      a token at POST /_/auth/extension/token.
//
// The code is useless without the secret, so nothing that can merely see the URL can redeem it,
// and the consent step means no page or extension can obtain a token silently.
import { assertAllowed, AuthError, mode, sessionSecret } from "./auth";
import { seal, unseal } from "./seal";
import { createToken, tokenTtlSeconds } from "./tokens";
import type { Env, Identity, User } from "./types";
import { b64urlEncode, json, linkPrefix, redirect } from "./util";

const CODE_TTL = 120;
const CHALLENGE_RE = /^[A-Za-z0-9_-]{43}$/;
type Code = Identity & { kind: "extcode"; challenge: string };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function page(title: string, body: string): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title>
<style>
  :root { color-scheme: light dark; --bg:#f7f6f3; --surface:#fff; --text:#1d1c1a; --muted:#6b6860; --line:#e2dfd8; --accent:#2f6f5e; --on:#fff; }
  @media (prefers-color-scheme: dark) { :root { --bg:#171715; --surface:#21201d; --text:#ecebe6; --muted:#a09c92; --line:#37352f; --accent:#6fbfa8; --on:#10241e; } }
  body { margin:0; background:var(--bg); color:var(--text); font:15px/1.5 system-ui,sans-serif; display:grid; place-items:center; min-height:100vh; padding:16px; box-sizing:border-box; }
  main { background:var(--surface); border:1px solid var(--line); border-radius:10px; padding:24px; max-width:420px; }
  h1 { font-size:18px; margin:0 0 8px; } p { margin:0 0 12px; } .muted { color:var(--muted); font-size:13px; }
  button { font:inherit; font-weight:600; padding:8px 16px; border-radius:6px; border:1px solid var(--accent); background:var(--accent); color:var(--on); cursor:pointer; }
</style></head><body><main>${body}</main></body></html>`;
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
      // Not "no-referrer": that makes the browser send "Origin: null" on the consent form's POST.
      "referrer-policy": "same-origin",
    },
  });
}

function requireOidc(env: Env): void {
  if (mode(env) !== "oidc") throw new AuthError("Extension sign-in is only used with AUTH_MODE=oidc.", 400);
}

/** GET /_/auth/extension (consent page) and POST /_/auth/extension (approve). Requires a signed-in user. */
export async function handleExtensionConnect(req: Request, env: Env, user: User): Promise<Response> {
  requireOidc(env);
  const url = new URL(req.url);

  if (req.method === "POST") {
    // Only our own consent page may approve. Browsers always send Origin on POST.
    if (req.headers.get("origin") !== url.origin) throw new AuthError("Cross-origin request refused.", 403);
    const challenge = String((await req.formData()).get("challenge") ?? "");
    if (!CHALLENGE_RE.test(challenge)) throw new AuthError("Invalid sign-in request.", 400);
    const code: Code = { kind: "extcode", challenge, email: user.email, name: user.name, groupAdmin: user.groupAdmin };
    return redirect(`/_/auth/extension/done#code=${await seal(code, sessionSecret(env), CODE_TTL)}`);
  }

  const challenge = url.searchParams.get("challenge") ?? "";
  if (!CHALLENGE_RE.test(challenge)) throw new AuthError("Invalid sign-in request. Start again from the extension's settings.", 400);
  const days = Math.round(tokenTtlSeconds(env) / 86400);
  return page(
    "Connect the Cairn extension",
    `<h1>Connect the browser extension?</h1>
<p>The Cairn extension in this browser will be signed in as <b>${esc(user.email)}</b> and can open, create and edit your ${esc(linkPrefix(env))}/ links.</p>
<p class="muted">It stays signed in for ${days} days. Only continue if you just asked the extension to sign in.</p>
<form method="post" action="/_/auth/extension"><input type="hidden" name="challenge" value="${esc(challenge)}"><button type="submit">Connect</button></form>`,
  );
}

export function handleExtensionDone(): Response {
  return page("Connected", `<h1>Almost done</h1><p>Finishing sign-in. This tab closes by itself; if it does not, you can close it.</p>`);
}

/** POST /_/auth/extension/token  { code, verifier } -> { token, email, expires_at }. No session needed. */
export async function handleExtensionToken(req: Request, env: Env): Promise<Response> {
  requireOidc(env);
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const body = (await req.json().catch(() => null)) as { code?: unknown; verifier?: unknown } | null;
  const code = await unseal<Code>(typeof body?.code === "string" ? body.code : null, sessionSecret(env));
  const verifier = typeof body?.verifier === "string" ? body.verifier : "";
  const digest = b64urlEncode(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  if (!code || code.kind !== "extcode" || !verifier || digest !== code.challenge) {
    return json({ error: "Sign-in code is invalid or has expired. Please try again." }, 400);
  }
  assertAllowed(env, code.email);
  const { token, expires_at } = await createToken(env, { email: code.email, name: code.name, groupAdmin: code.groupAdmin });
  return json({ token, email: code.email, expires_at });
}
