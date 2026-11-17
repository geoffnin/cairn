import { afterEach, describe, expect, it, vi } from "vitest";
import { _resetIdentityCache } from "../src/auth";
import { _resetJwksCache } from "../src/jwt";
import { b64urlEncode } from "../src/util";
import { ISSUER, accessToken, call, genKeys, seedAccessKeys, signJwt } from "./helpers";

const exp = () => Math.floor(Date.now() / 1000) + 300;
const me = (token: string | null, env = {}) =>
  call("/_/api/me", { as: null, headers: token ? { "cf-access-jwt-assertion": token } : {}, env });

afterEach(() => vi.unstubAllGlobals());

describe("cloudflare access", () => {
  it("trusts a valid Access token", async () => {
    const res = await me(await accessToken("Dave@Example.com", { name: "Dave" }));
    expect(await res.json()).toEqual({ email: "dave@example.com", name: "Dave", isAdmin: false });
  });

  it("makes admins from ADMIN_EMAILS and from groups, top-level or custom", async () => {
    expect(await (await me(await accessToken("admin@example.com"))).json()).toMatchObject({ isAdmin: true });
    expect(await (await me(await accessToken("g@example.com", { groups: ["Everyone", "GoLink-Admins"] }))).json()).toMatchObject({ isAdmin: true });
    expect(await (await me(await accessToken("c@example.com", { custom: { groups: ["golink-admins"] } }))).json()).toMatchObject({ isAdmin: true });
    expect(await (await me(await accessToken("n@example.com", { groups: ["everyone"] }))).json()).toMatchObject({ isAdmin: false });
  });

  it.each([
    ["no token", null],
    ["wrong audience", { aud: ["other"] }],
    ["wrong issuer", { iss: "https://evil.cloudflareaccess.com" }],
    ["expired", { exp: 1000 }],
    ["not yet valid", { nbf: exp() + 600 }],
    ["no email (service token)", { email: undefined, common_name: "svc" }],
  ])("rejects %s", async (_n, override) => {
    const token = override === null ? null : await accessToken("x@example.com", override);
    const res = await me(token);
    expect(res.status).toBe(401);
    expect(await res.json()).toHaveProperty("error");
  });

  it("rejects a token signed by another key, an unsigned token, and junk", async () => {
    const forged = await signJwt({ iss: ISSUER, aud: "aud123", exp: exp(), email: "x@example.com" }, (await genKeys()).privateKey);
    const none = `${b64urlEncode('{"alg":"none"}')}.${b64urlEncode(JSON.stringify({ iss: ISSUER, aud: "aud123", exp: exp(), email: "x@y.z" }))}.`;
    for (const token of [forged, none, "junk"]) expect((await me(token)).status).toBe(401);
  });

  it("refetches keys when Access rotates them", async () => {
    const rotated = await genKeys();
    const jwk = { ...((await crypto.subtle.exportKey("jwk", rotated.publicKey)) as JsonWebKey), kid: "k2" };
    let fetched = 0;
    vi.stubGlobal("fetch", async (url: string) => {
      fetched++;
      expect(String(url)).toBe(`${ISSUER}/cdn-cgi/access/certs`);
      return Response.json({ keys: [jwk] });
    });
    _resetJwksCache();
    seedAccessKeys(120); // keys fetched two minutes ago, before the rotation
    const head = b64urlEncode(JSON.stringify({ alg: "RS256", kid: "k2" }));
    const body = b64urlEncode(JSON.stringify({ iss: ISSUER, aud: "aud123", exp: exp(), email: "r@example.com" }));
    const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", rotated.privateKey, new TextEncoder().encode(`${head}.${body}`));
    // The token's kid is not in the cached keys, which forces a refetch.
    const res = await call("/_/api/me", { as: null, keepKeys: true, headers: { "cf-access-jwt-assertion": `${head}.${body}.${b64urlEncode(sig)}` } });
    expect(await res.json()).toMatchObject({ email: "r@example.com" });
    expect(fetched).toBe(1);
  });

  it("applies ALLOWED_EMAIL_DOMAINS on every request", async () => {
    const token = await accessToken("c@example.com");
    expect((await me(token, { ALLOWED_EMAIL_DOMAINS: "corp.test, example.com" })).status).toBe(200);
    expect((await me(token, { ALLOWED_EMAIL_DOMAINS: "corp.test" })).status).toBe(403);
    expect((await call("/docs", { env: { ALLOWED_EMAIL_DOMAINS: "corp.test" } })).status).toBe(403);
  });

  it("fails closed when Access is not configured", async () => {
    expect((await me(await accessToken("c@example.com"), { ACCESS_AUD: "" })).status).toBe(401);
    expect((await me(await accessToken("c@example.com"), { AUTH_MODE: "oidc" })).status).toBe(500);
  });

  it("signs out through Access", async () => {
    expect((await call("/_/auth/logout")).headers.get("location")).toBe("/cdn-cgi/access/logout");
  });

  it("no longer serves the old sign-in routes", async () => {
    for (const p of ["/_/auth/login", "/_/auth/callback", "/_/auth/extension"]) {
      expect((await call(p)).status, p).toBe(404);
    }
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

describe("access turned on for the Worker (ctx.access)", () => {
  const identity = (extra: Partial<CloudflareAccessIdentity> = {}): CloudflareAccessIdentity => ({ email: "Erin@Example.com", name: "Erin", ...extra });
  const meWith = (workerAccess: CloudflareAccessIdentity | undefined, env = {}, headers: Record<string, string> = {}) =>
    call("/_/api/me", { as: null, workerAccess, env, headers });

  afterEach(() => _resetIdentityCache());

  it("uses the runtime's identity, with no Access settings in Cairn", async () => {
    const res = await meWith(identity(), { ACCESS_TEAM_DOMAIN: "", ACCESS_AUD: "" });
    expect(await res.json()).toEqual({ email: "erin@example.com", name: "Erin", isAdmin: false });
  });

  it("makes admins from group names", async () => {
    const groups = [{ id: "1", name: "Everyone" }, { id: "2", name: "GoLink-Admins" }];
    expect(await (await meWith(identity({ groups }))).json()).toMatchObject({ isAdmin: true });
  });

  it("refuses when Access gives no identity or no email", async () => {
    expect((await meWith(undefined)).status).toBe(401);
    expect((await meWith({ name: "svc" })).status).toBe(401);
  });

  it("still applies ALLOWED_EMAIL_DOMAINS, including to cached identities", async () => {
    const h = { "cf-access-jwt-assertion": "tok-1" };
    expect((await meWith(identity(), {}, h)).status).toBe(200);
    expect((await meWith(identity(), { ALLOWED_EMAIL_DOMAINS: "corp.test" }, h)).status).toBe(403);
  });

  it("reuses an identity for the same Access token", async () => {
    let calls = 0;
    const access = { email: "f@example.com" };
    const counting = new Proxy(access, { get: (t, k) => (k === "email" && calls++, Reflect.get(t, k)) });
    const h = { "cf-access-jwt-assertion": "tok-2" };
    await meWith(counting as CloudflareAccessIdentity, {}, h);
    const first = calls;
    await meWith(counting as CloudflareAccessIdentity, {}, h);
    expect(calls).toBe(first);
  });

  it("explains how to turn Access on when nothing protects the Worker", async () => {
    const res = await call("/_/api/me", { as: null, env: { ACCESS_TEAM_DOMAIN: "", ACCESS_AUD: "" } });
    expect(res.status).toBe(401);
    expect((await res.json<{ error: string }>()).error).toMatch(/Turn on Cloudflare Access for this Worker/);
  });
});
