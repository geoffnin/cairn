// Authentication. Three modes (env.AUTH_MODE):
//   oidc   - OpenID Connect authorization-code flow with PKCE against any compliant IdP.
//   access - Cloudflare Access sits in front and has already authenticated the user
//            (this is the path for SAML-only IdPs); we verify the JWT it attaches.
//   dev    - fixed user, honoured on localhost only.
import { verifyJwt } from "./jwt";
import { seal, unseal } from "./seal";
import { lookupToken } from "./tokens";
import type { Env, Identity, User } from "./types";
import { b64urlEncode, bearerToken, csv, getCookie, randomToken, redirect, safeReturnPath, setCookie } from "./util";

const SESSION_COOKIE = "cairn_session";
const FLOW_COOKIE = "cairn_oidc";
const FLOW_TTL = 600;

type Session = Identity & { kind?: string };
interface Flow {
  state: string;
  nonce: string;
  verifier: string;
  rd: string;
}
interface Discovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  token_endpoint_auth_methods_supported?: string[];
}

export class AuthError extends Error {
  constructor(
    message: string,
    public status = 403,
  ) {
    super(message);
  }
}

export function mode(env: Env): string {
  return (env.AUTH_MODE || "oidc").toLowerCase();
}

export function sessionSecret(env: Env): string {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) {
    throw new AuthError("Server misconfigured: SESSION_SECRET must be set to at least 32 characters.", 500);
  }
  return env.SESSION_SECRET;
}

function toUser(env: Env, email: string, name: string, groupAdmin: boolean): User {
  email = email.toLowerCase();
  return { email, name: name || email, isAdmin: groupAdmin || csv(env.ADMIN_EMAILS).includes(email), groupAdmin };
}

export function assertAllowed(env: Env, email: string): void {
  const domains = csv(env.ALLOWED_EMAIL_DOMAINS);
  if (domains.length && !domains.includes(email.toLowerCase().split("@")[1] ?? "")) {
    throw new AuthError(`${email} is not allowed to use this service.`);
  }
}

function inAdminGroup(env: Env, groups: unknown): boolean {
  const admin = csv(env.ADMIN_GROUPS);
  return Array.isArray(groups) && groups.some((g) => typeof g === "string" && admin.includes(g.toLowerCase()));
}

function isLocalhost(req: Request): boolean {
  const host = new URL(req.url).hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

/** Returns the current user, or null if the request is not authenticated. */
export async function authenticate(req: Request, env: Env): Promise<User | null> {
  switch (mode(env)) {
    case "dev":
      if (!isLocalhost(req)) throw new AuthError("AUTH_MODE=dev only works on localhost.", 500);
      return toUser(env, env.DEV_USER_EMAIL || "dev@example.com", "Dev User", false);

    case "access": {
      const token = req.headers.get("cf-access-jwt-assertion");
      if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) {
        throw new AuthError("Server misconfigured: ACCESS_TEAM_DOMAIN and ACCESS_AUD are required.", 500);
      }
      if (!token) throw new AuthError("This hostname is not protected by Cloudflare Access.", 401);
      const base = `https://${env.ACCESS_TEAM_DOMAIN}`;
      let claims: Record<string, unknown>;
      try {
        claims = await verifyJwt(token, { jwksUrl: `${base}/cdn-cgi/access/certs`, issuer: base, audience: env.ACCESS_AUD });
      } catch (e) {
        throw new AuthError(`Invalid Cloudflare Access token: ${(e as Error).message}`, 401);
      }
      if (typeof claims.email !== "string" || !claims.email) throw new AuthError("Access token has no email.", 401);
      assertAllowed(env, claims.email);
      return toUser(env, claims.email, typeof claims.name === "string" ? claims.name : "", inAdminGroup(env, claims.groups));
    }

    case "oidc": {
      // The browser extension signs in once and then presents a long-lived, revocable token.
      const token = bearerToken(req);
      let who: Identity | null;
      if (token) {
        who = await lookupToken(env, token);
      } else {
        const s = await unseal<Session>(getCookie(req, SESSION_COOKIE), sessionSecret(env));
        who = s && typeof s.email === "string" && !s.kind ? s : null;
      }
      if (!who) return null;
      // Re-checked on every request so tightening ALLOWED_EMAIL_DOMAINS takes effect immediately.
      assertAllowed(env, who.email);
      return toUser(env, who.email, who.name, who.groupAdmin);
    }

    default:
      throw new AuthError(`Server misconfigured: unknown AUTH_MODE "${env.AUTH_MODE}".`, 500);
  }
}

let discoveryCache: { issuer: string; doc: Discovery; at: number } | null = null;

async function discover(env: Env): Promise<Discovery> {
  if (!env.OIDC_ISSUER || !env.OIDC_CLIENT_ID || !env.OIDC_CLIENT_SECRET) {
    throw new AuthError("Server misconfigured: OIDC_ISSUER, OIDC_CLIENT_ID and OIDC_CLIENT_SECRET are required.", 500);
  }
  const issuer = env.OIDC_ISSUER.replace(/\/+$/, "");
  if (discoveryCache && discoveryCache.issuer === issuer && Date.now() - discoveryCache.at < 3600_000) {
    return discoveryCache.doc;
  }
  const res = await fetch(`${issuer}/.well-known/openid-configuration`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new AuthError(`OIDC discovery failed (${res.status}).`, 502);
  const doc = (await res.json()) as Discovery;
  discoveryCache = { issuer, doc, at: Date.now() };
  return doc;
}

function callbackUrl(req: Request): string {
  return `${new URL(req.url).origin}/_/auth/callback`;
}

export async function handleLogin(req: Request, env: Env): Promise<Response> {
  const rd = safeReturnPath(new URL(req.url).searchParams.get("rd"));
  if (mode(env) !== "oidc") return redirect(rd);

  const doc = await discover(env);
  const flow: Flow = { state: randomToken(), nonce: randomToken(), verifier: randomToken(48), rd };
  const challenge = b64urlEncode(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(flow.verifier)));
  const auth = new URL(doc.authorization_endpoint);
  for (const [k, v] of Object.entries({
    response_type: "code",
    client_id: env.OIDC_CLIENT_ID!,
    redirect_uri: callbackUrl(req),
    scope: env.OIDC_SCOPES || "openid email profile",
    state: flow.state,
    nonce: flow.nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
  })) {
    auth.searchParams.set(k, v);
  }
  const cookie = await seal(flow, sessionSecret(env), FLOW_TTL);
  return redirect(auth.toString(), [["set-cookie", setCookie(req, FLOW_COOKIE, cookie, FLOW_TTL)]]);
}

export async function handleCallback(req: Request, env: Env): Promise<Response> {
  if (mode(env) !== "oidc") return redirect("/_/");
  const params = new URL(req.url).searchParams;
  const secret = sessionSecret(env);
  const flow = await unseal<Flow>(getCookie(req, FLOW_COOKIE), secret);

  if (params.get("error")) {
    throw new AuthError(`Sign-in failed: ${params.get("error_description") || params.get("error")}`);
  }
  const code = params.get("code");
  if (!flow || !code || params.get("state") !== flow.state) {
    throw new AuthError("Sign-in session expired or invalid. Please try again.", 400);
  }

  const doc = await discover(env);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: callbackUrl(req),
    code_verifier: flow.verifier,
  });
  const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded", accept: "application/json" };
  const methods = doc.token_endpoint_auth_methods_supported ?? ["client_secret_basic"];
  if (methods.includes("client_secret_basic")) {
    const pair = `${encodeURIComponent(env.OIDC_CLIENT_ID!)}:${encodeURIComponent(env.OIDC_CLIENT_SECRET!)}`;
    headers.authorization = `Basic ${btoa(pair)}`;
  } else {
    body.set("client_id", env.OIDC_CLIENT_ID!);
    body.set("client_secret", env.OIDC_CLIENT_SECRET!);
  }
  const res = await fetch(doc.token_endpoint, { method: "POST", headers, body });
  if (!res.ok) throw new AuthError(`Token exchange failed (${res.status}).`, 502);
  const { id_token } = (await res.json()) as { id_token?: string };
  if (!id_token) throw new AuthError("IdP returned no id_token.", 502);

  let claims: Record<string, unknown>;
  try {
    claims = await verifyJwt(id_token, { jwksUrl: doc.jwks_uri, issuer: doc.issuer, audience: env.OIDC_CLIENT_ID! });
  } catch (e) {
    throw new AuthError(`Invalid id_token: ${(e as Error).message}`, 401);
  }
  if (claims.nonce !== flow.nonce) throw new AuthError("Invalid id_token: nonce mismatch.", 401);

  // Entra ID often omits `email`; `preferred_username` is the UPN there.
  const email = [claims.email, claims.preferred_username].find((v) => typeof v === "string" && v.includes("@")) as
    | string
    | undefined;
  if (!email) throw new AuthError("Your identity provider did not supply an email address (is the `email` scope granted?).");
  if (claims.email_verified === false) throw new AuthError("Your email address is not verified.");
  assertAllowed(env, email);

  const ttl = Math.max(1, Number(env.SESSION_TTL_HOURS) || 24) * 3600;
  const session: Session = {
    email: email.toLowerCase(),
    name: typeof claims.name === "string" ? claims.name : "",
    groupAdmin: inAdminGroup(env, claims.groups),
  };
  return redirect(flow.rd, [
    ["set-cookie", setCookie(req, SESSION_COOKIE, await seal(session, secret, ttl), ttl)],
    ["set-cookie", setCookie(req, FLOW_COOKIE, "", 0)],
  ]);
}

export function handleLogout(req: Request, env: Env): Response {
  if (mode(env) === "access") return redirect("/cdn-cgi/access/logout");
  return new Response("Signed out.", {
    headers: { "set-cookie": setCookie(req, SESSION_COOKIE, "", 0), "content-type": "text/plain", "cache-control": "no-store" },
  });
}

export function _resetDiscoveryCache(): void {
  discoveryCache = null;
}
