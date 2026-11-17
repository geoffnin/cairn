import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { _resetDiscoveryCache } from "../src/auth";
import { _resetJwksCache } from "../src/jwt";
import { b64urlEncode } from "../src/util";
import { call } from "./helpers";

const ISSUER = "https://idp.test";
let keys: CryptoKeyPair;
let jwk: JsonWebKey & { kid: string };
let tokenRequests: { auth: string | null; body: URLSearchParams }[];
let idClaims: Record<string, unknown>;

async function signJwt(claims: Record<string, unknown>, key = keys.privateKey, alg = "RS256"): Promise<string> {
  const head = b64urlEncode(JSON.stringify({ alg, kid: "k1", typ: "JWT" }));
  const body = b64urlEncode(JSON.stringify(claims));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64urlEncode(sig)}`;
}

const genKeys = () =>
  crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  ) as Promise<CryptoKeyPair>;

beforeAll(async () => {
  keys = await genKeys();
  jwk = { ...((await crypto.subtle.exportKey("jwk", keys.publicKey)) as JsonWebKey), kid: "k1" };
});

beforeEach(() => {
  _resetDiscoveryCache();
  _resetJwksCache();
  tokenRequests = [];
  idClaims = {};
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url === `${ISSUER}/.well-known/openid-configuration`) {
      return Response.json({
        issuer: ISSUER,
        authorization_endpoint: `${ISSUER}/authorize`,
        token_endpoint: `${ISSUER}/token`,
        jwks_uri: `${ISSUER}/keys`,
      });
    }
    if (url === `${ISSUER}/keys` || url === "https://team.cloudflareaccess.com/cdn-cgi/access/certs") {
      return Response.json({ keys: [jwk] });
    }
    if (url === `${ISSUER}/token`) {
      tokenRequests.push({
        auth: new Headers(init?.headers).get("authorization"),
        body: new URLSearchParams(String(init?.body)),
      });
      return Response.json({ id_token: await signJwt(idClaims) });
    }
    throw new Error(`unexpected fetch ${url}`);
  });
});

afterEach(() => vi.unstubAllGlobals());

const cookieOf = (res: Response, name: string) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0]!)
    .find((c) => c.startsWith(`${name}=`));

async function startLogin(rd = "/roadmap?x=1") {
  const res = await call(`/_/auth/login?rd=${encodeURIComponent(rd)}`, { as: null });
  const auth = new URL(res.headers.get("location")!);
  return { auth, flowCookie: cookieOf(res, "cairn_oidc")! };
}

const exp = () => Math.floor(Date.now() / 1000) + 300;

describe("oidc", () => {
  it("completes the code flow with PKCE and issues a session", async () => {
    const { auth, flowCookie } = await startLogin();
    expect(auth.origin + auth.pathname).toBe(`${ISSUER}/authorize`);
    expect(auth.searchParams.get("client_id")).toBe("cairn-client");
    expect(auth.searchParams.get("redirect_uri")).toBe("https://go.example.com/_/auth/callback");
    expect(auth.searchParams.get("code_challenge_method")).toBe("S256");

    idClaims = {
      iss: ISSUER,
      aud: "cairn-client",
      exp: exp(),
      nonce: auth.searchParams.get("nonce"),
      email: "Carol@Example.com",
      name: "Carol",
      groups: ["Everyone", "golink-admins"],
    };
    const cb = await call(`/_/auth/callback?code=abc&state=${auth.searchParams.get("state")}`, {
      as: null,
      headers: { cookie: flowCookie },
    });
    expect(cb.status).toBe(302);
    expect(cb.headers.get("location")).toBe("/roadmap?x=1");

    // PKCE verifier matches the challenge; client authenticates with HTTP Basic.
    const tr = tokenRequests[0]!;
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(tr.body.get("code_verifier")!));
    expect(b64urlEncode(digest)).toBe(auth.searchParams.get("code_challenge"));
    expect(tr.auth).toBe(`Basic ${btoa("cairn-client:shh")}`);

    const me = await call("/_/api/me", { as: null, headers: { cookie: cookieOf(cb, "cairn_session")! } });
    expect(await me.json()).toEqual({ email: "carol@example.com", name: "Carol", isAdmin: true, groupAdmin: true });
  });

  async function callbackWith(claims: Record<string, unknown>, env = {}) {
    const { auth, flowCookie } = await startLogin();
    idClaims = { iss: ISSUER, aud: "cairn-client", exp: exp(), nonce: auth.searchParams.get("nonce"), email: "c@example.com", ...claims };
    return call(`/_/auth/callback?code=abc&state=${auth.searchParams.get("state")}`, {
      as: null,
      headers: { cookie: flowCookie },
      env,
    });
  }

  it.each([
    ["wrong audience", { aud: "someone-else" }],
    ["wrong issuer", { iss: "https://evil.test" }],
    ["expired", { exp: 1000 }],
    ["wrong nonce", { nonce: "nope" }],
  ])("rejects an id_token with %s", async (_n, claims) => {
    const res = await callbackWith(claims);
    expect(res.status).toBe(401);
    expect(res.headers.getSetCookie()).toEqual([]);
  });

  it("rejects unverified emails and disallowed domains", async () => {
    expect((await callbackWith({ email_verified: false })).status).toBe(403);
    expect((await callbackWith({}, { ALLOWED_EMAIL_DOMAINS: "corp.test" })).status).toBe(403);
    expect((await callbackWith({}, { ALLOWED_EMAIL_DOMAINS: "corp.test, example.com" })).status).toBe(302);
  });

  it("rejects a token signed by another key", async () => {
    const { auth, flowCookie } = await startLogin();
    const other = await genKeys();
    const claims = { iss: ISSUER, aud: "cairn-client", exp: exp(), nonce: auth.searchParams.get("nonce"), email: "c@example.com" };
    const forged = await signJwt(claims, other.privateKey);
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/token")) return Response.json({ id_token: forged });
      if (url.endsWith("/keys")) return Response.json({ keys: [jwk] });
      return Response.json({ issuer: ISSUER, authorization_endpoint: `${ISSUER}/authorize`, token_endpoint: `${ISSUER}/token`, jwks_uri: `${ISSUER}/keys` });
    });
    const res = await call(`/_/auth/callback?code=abc&state=${auth.searchParams.get("state")}`, { as: null, headers: { cookie: flowCookie } });
    expect(res.status).toBe(401);
  });

  it("rejects a callback with the wrong state or no flow cookie", async () => {
    const { auth, flowCookie } = await startLogin();
    expect((await call("/_/auth/callback?code=abc&state=wrong", { as: null, headers: { cookie: flowCookie } })).status).toBe(400);
    expect((await call(`/_/auth/callback?code=abc&state=${auth.searchParams.get("state")}`, { as: null })).status).toBe(400);
    expect(tokenRequests).toHaveLength(0);
  });

  it("never redirects off-site after login", async () => {
    for (const rd of ["https://evil.test/", "//evil.test", "/\\evil.test"]) {
      const { auth, flowCookie } = await startLogin(rd);
      idClaims = { iss: ISSUER, aud: "cairn-client", exp: exp(), nonce: auth.searchParams.get("nonce"), email: "c@example.com" };
      const cb = await call(`/_/auth/callback?code=abc&state=${auth.searchParams.get("state")}`, { as: null, headers: { cookie: flowCookie } });
      expect(cb.headers.get("location")).toBe("/_/");
    }
  });

  it("rejects tampered and expired session cookies", async () => {
    const { sessionCookie } = await import("./helpers");
    const good = await sessionCookie("alice@example.com");
    const [body, sig] = good.slice("cairn_session=".length).split(".");
    const forgedBody = b64urlEncode(JSON.stringify({ email: "admin@example.com", name: "", groupAdmin: true, exp: exp() }));
    expect((await call("/_/api/me", { as: null, headers: { cookie: `cairn_session=${forgedBody}.${sig}` } })).status).toBe(401);
    expect((await call("/_/api/me", { as: null, headers: { cookie: `cairn_session=${body}.${sig}` } })).status).toBe(200);
    expect((await call("/_/api/me", { as: null, env: { SESSION_SECRET: "a-different-secret-of-sufficient-length!" }, headers: { cookie: good } })).status).toBe(401);
  });

  it("applies ALLOWED_EMAIL_DOMAINS to sessions that already exist", async () => {
    expect((await call("/_/api/me", { env: { ALLOWED_EMAIL_DOMAINS: "example.com" } })).status).toBe(200);
    expect((await call("/_/api/me", { env: { ALLOWED_EMAIL_DOMAINS: "corp.test" } })).status).toBe(403);
    expect((await call("/docs", { env: { ALLOWED_EMAIL_DOMAINS: "corp.test" } })).status).toBe(403);
  });

  it("fails closed without a strong session secret", async () => {
    expect((await call("/_/api/me", { env: { SESSION_SECRET: "short" } })).status).toBe(500);
  });
});

describe("cloudflare access mode", () => {
  const accessEnv = { AUTH_MODE: "access", ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com", ACCESS_AUD: "aud123" };
  const token = (claims: Record<string, unknown> = {}) =>
    signJwt({ iss: "https://team.cloudflareaccess.com", aud: ["aud123"], exp: exp(), email: "dave@example.com", ...claims });

  it("trusts a valid Access JWT", async () => {
    const res = await call("/_/api/me", { as: null, env: accessEnv, headers: { "cf-access-jwt-assertion": await token() } });
    expect(await res.json()).toMatchObject({ email: "dave@example.com", isAdmin: false });
  });

  it("rejects missing, wrong-audience and unsigned tokens", async () => {
    expect((await call("/_/api/me", { as: null, env: accessEnv })).status).toBe(401);
    const bad = await token({ aud: ["other"] });
    expect((await call("/_/api/me", { as: null, env: accessEnv, headers: { "cf-access-jwt-assertion": bad } })).status).toBe(401);
    const none = `${b64urlEncode('{"alg":"none"}')}.${b64urlEncode(JSON.stringify({ iss: "https://team.cloudflareaccess.com", aud: "aud123", exp: exp(), email: "x@y.z" }))}.`;
    expect((await call("/_/api/me", { as: null, env: accessEnv, headers: { "cf-access-jwt-assertion": none } })).status).toBe(401);
  });

  it("ignores session cookies", async () => {
    expect((await call("/_/api/me", { env: accessEnv })).status).toBe(401);
  });
});

describe("dev mode", () => {
  it("works on localhost only", async () => {
    const dev = { AUTH_MODE: "dev", DEV_USER_EMAIL: "me@local.test" };
    const ok = await call("/_/api/me", { as: null, env: dev, origin: "http://localhost:8787" });
    expect(await ok.json()).toMatchObject({ email: "me@local.test" });
    expect((await call("/_/api/me", { as: null, env: dev })).status).toBe(500);
  });
});
