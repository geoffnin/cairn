// Authentication. Cairn runs behind Cloudflare Access, which signs people in (with Okta, Entra ID,
// Google, any SAML or OIDC provider) before a request reaches the Worker, and attaches a signed
// JWT in the Cf-Access-Jwt-Assertion header. Cairn only verifies that token.
//
//   AUTH_MODE=access (default)  verify the Access token on every request
//   AUTH_MODE=dev               fixed user, honoured on localhost only, for `wrangler dev`
import { verifyJwt } from "./jwt";
import type { Env, User } from "./types";
import { csv, redirect } from "./util";

export class AuthError extends Error {
  constructor(
    message: string,
    public status = 403,
  ) {
    super(message);
  }
}

export function mode(env: Env): "access" | "dev" {
  const m = (env.AUTH_MODE || "access").toLowerCase();
  if (m !== "access" && m !== "dev") throw new AuthError(`Server misconfigured: unknown AUTH_MODE "${env.AUTH_MODE}".`, 500);
  return m;
}

export function assertAllowed(env: Env, email: string): void {
  const domains = csv(env.ALLOWED_EMAIL_DOMAINS);
  if (domains.length && !domains.includes(email.toLowerCase().split("@")[1] ?? "")) {
    throw new AuthError(`${email} is not allowed to use this service.`);
  }
}

/**
 * Group names from the token. Access only includes groups if they are added as a custom OIDC
 * claim or SAML attribute on the identity provider in Zero Trust; depending on setup they arrive
 * at the top level or under `custom`, so both are read.
 */
function groupsOf(claims: Record<string, unknown>): unknown[] {
  const custom = claims.custom as Record<string, unknown> | undefined;
  const groups = claims.groups ?? custom?.groups;
  return Array.isArray(groups) ? groups : [];
}

function toUser(env: Env, email: string, name: string, groups: unknown[]): User {
  email = email.toLowerCase();
  const adminGroups = csv(env.ADMIN_GROUPS);
  const groupAdmin = groups.some((g) => typeof g === "string" && adminGroups.includes(g.toLowerCase()));
  return { email, name: name || email, isAdmin: groupAdmin || csv(env.ADMIN_EMAILS).includes(email) };
}

function isLocalhost(req: Request): boolean {
  const host = new URL(req.url).hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

/** Returns the signed-in user, or throws AuthError. */
export async function authenticate(req: Request, env: Env): Promise<User> {
  if (mode(env) === "dev") {
    if (!isLocalhost(req)) throw new AuthError("AUTH_MODE=dev only works on localhost.", 500);
    return toUser(env, env.DEV_USER_EMAIL || "dev@example.com", "Dev User", []);
  }

  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) {
    throw new AuthError("Server misconfigured: ACCESS_TEAM_DOMAIN and ACCESS_AUD are required.", 500);
  }
  const token = req.headers.get("cf-access-jwt-assertion");
  if (!token) {
    throw new AuthError("Not signed in. This hostname must be protected by a Cloudflare Access application.", 401);
  }
  const base = `https://${env.ACCESS_TEAM_DOMAIN.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  let claims: Record<string, unknown>;
  try {
    claims = await verifyJwt(token, { jwksUrl: `${base}/cdn-cgi/access/certs`, issuer: base, audience: env.ACCESS_AUD });
  } catch (e) {
    throw new AuthError(`Invalid Cloudflare Access token: ${(e as Error).message}`, 401);
  }
  if (typeof claims.email !== "string" || !claims.email.includes("@")) {
    throw new AuthError("The Access token has no email address. Service tokens cannot use Cairn.", 401);
  }
  assertAllowed(env, claims.email);
  return toUser(env, claims.email, typeof claims.name === "string" ? claims.name : "", groupsOf(claims));
}

export function handleLogout(req: Request, env: Env): Response {
  if (mode(env) === "dev") return new Response("Dev mode has no sign-out.", { headers: { "content-type": "text/plain" } });
  return redirect("/cdn-cgi/access/logout");
}
