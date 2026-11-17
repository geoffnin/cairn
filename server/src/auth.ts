// Authentication. Cairn runs behind Cloudflare Access, which signs people in (with Okta, Entra ID,
// Google, any SAML or OIDC provider) before a request reaches the Worker. Two ways to set it up:
//
//   1. Access turned on for the Worker itself (recommended, and what the Deploy to Cloudflare
//      install uses). The runtime then provides ctx.access, and ctx.access.getIdentity() returns
//      the signed-in person, groups included. Nothing to configure in Cairn.
//   2. A separate Access application in front of the hostname. Cairn verifies the JWT in the
//      Cf-Access-Jwt-Assertion header itself, using ACCESS_TEAM_DOMAIN and ACCESS_AUD.
//
// Without either, every request is refused.
//
//   AUTH_MODE=access (default)  as above
//   AUTH_MODE=dev               fixed user, honoured on localhost only, for `wrangler dev`
import { verifyJwt } from "./jwt";
import { inSpan, type SpanHandle } from "./tracing";
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

// getIdentity() results, keyed by the Access token they belong to, so a burst of redirects from
// one person does not ask for their identity every time.
const IDENTITY_TTL_MS = 60_000;
const IDENTITY_MAX = 1000;
const identities = new Map<string, { user: User; exp: number }>();

async function fromWorkerAccess(req: Request, env: Env, access: CloudflareAccessContext, span: SpanHandle): Promise<User> {
  const token = req.headers.get("cf-access-jwt-assertion");
  const cached = token ? identities.get(token) : undefined;
  span.setAttribute("auth.identity_cached", !!(cached && cached.exp > Date.now()));
  if (cached && cached.exp > Date.now()) {
    assertAllowed(env, cached.user.email);
    return cached.user;
  }
  const identity = await access.getIdentity();
  const email = identity?.email;
  if (typeof email !== "string" || !email.includes("@")) {
    throw new AuthError("Cloudflare Access did not provide an email address. Service tokens cannot use Cairn.", 401);
  }
  assertAllowed(env, email);
  const groups = (identity?.groups ?? []).map((g) => g?.name);
  const user = toUser(env, email, typeof identity?.name === "string" ? identity.name : "", groups);
  if (token) {
    if (identities.size >= IDENTITY_MAX) identities.delete(identities.keys().next().value!);
    identities.set(token, { user, exp: Date.now() + IDENTITY_TTL_MS });
  }
  return user;
}

/** Returns the signed-in user, or throws AuthError. */
export function authenticate(req: Request, env: Env, ctx?: ExecutionContext): Promise<User> {
  return inSpan("cairn.auth", {}, (span) => authenticateIn(req, env, ctx, span));
}

async function authenticateIn(req: Request, env: Env, ctx: ExecutionContext | undefined, span: SpanHandle): Promise<User> {
  if (mode(env) === "dev") {
    span.setAttribute("auth.method", "dev");
    if (!isLocalhost(req)) throw new AuthError("AUTH_MODE=dev only works on localhost.", 500);
    return toUser(env, env.DEV_USER_EMAIL || "dev@example.com", "Dev User", []);
  }

  // Present only when Access is on for this Worker and has authenticated this request.
  if (ctx?.access) {
    span.setAttribute("auth.method", "worker_access");
    return fromWorkerAccess(req, env, ctx.access, span);
  }
  span.setAttribute("auth.method", "access_jwt");

  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) {
    throw new AuthError(
      "Not signed in. Turn on Cloudflare Access for this Worker in its settings in the Cloudflare dashboard " +
        "(or set ACCESS_TEAM_DOMAIN and ACCESS_AUD if a separate Access application protects this hostname).",
      401,
    );
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

export function _resetIdentityCache(): void {
  identities.clear();
}

export function handleLogout(req: Request, env: Env): Response {
  if (mode(env) === "dev") return new Response("Dev mode has no sign-out.", { headers: { "content-type": "text/plain" } });
  return redirect("/cdn-cgi/access/logout");
}
