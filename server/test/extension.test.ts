import { beforeEach, describe, expect, it } from "vitest";
import { _resetMemCache } from "../src/links";
import { _resetTokenCache } from "../src/tokens";
import { b64urlEncode } from "../src/util";
import { call, env, ORIGIN } from "./helpers";

beforeEach(async () => {
  await env.DB.exec("DELETE FROM links");
  await env.DB.exec("DELETE FROM extension_tokens");
  _resetMemCache();
  _resetTokenCache();
});

const sha = async (s: string) => b64urlEncode(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
const form = (challenge: string, origin = ORIGIN) => ({
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded", origin },
  rawBody: `challenge=${challenge}`,
});

async function approve(verifier: string, as = "alice@example.com"): Promise<string> {
  const res = await call("/_/auth/extension", { ...form(await sha(verifier)), as });
  expect(res.status).toBe(302);
  const loc = res.headers.get("location")!;
  expect(loc.startsWith("/_/auth/extension/done#code=")).toBe(true);
  return loc.split("#code=")[1]!;
}

const exchange = (code: string, verifier: string, extra = {}) =>
  call("/_/auth/extension/token", { method: "POST", as: null, body: { code, verifier }, ...extra });

async function connect(as = "alice@example.com"): Promise<string> {
  const verifier = `verifier-${crypto.randomUUID()}`;
  const res = await exchange(await approve(verifier, as), verifier);
  expect(res.status).toBe(200);
  return (await res.json<{ token: string }>()).token;
}

const bearer = (token: string) => ({ as: null, headers: { authorization: `Bearer ${token}` } });

describe("server config", () => {
  it("publishes prefix and auth mode without sign-in", async () => {
    const res = await call("/_/config", { as: null });
    expect(await res.json()).toEqual({ name: "Cairn", prefix: "go", auth: "oidc" });
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("uses a custom LINK_PREFIX everywhere", async () => {
    const custom = { env: { LINK_PREFIX: "Acme" } };
    expect(await (await call("/_/config", { as: null, ...custom })).json()).toMatchObject({ prefix: "acme" });
    const html = await (await call("/_/", custom)).text();
    expect(html).toContain("<span>acme/</span>");
    expect(html).not.toContain("go/");
    await call("/_/api/links", { method: "POST", body: { slug: "x", url: "https://a.test" }, ...custom });
    const dup = await call("/_/api/links", { method: "POST", body: { slug: "x", url: "https://a.test" }, ...custom });
    expect((await dup.json<{ error: string }>()).error).toBe("acme/x already exists.");
  });

  it("rejects a prefix that could not be a hostname", async () => {
    for (const bad of ["a b", "go/links", "-go", "<script>"]) {
      expect((await call("/_/config", { as: null, env: { LINK_PREFIX: bad } })).status, bad).toBe(500);
    }
  });
});

describe("extension sign-in", () => {
  it("shows a consent page naming the user, and sends anonymous visitors to log in first", async () => {
    const challenge = await sha("v");
    const res = await call(`/_/auth/extension?challenge=${challenge}`);
    const html = await res.text();
    expect(html).toContain("alice@example.com");
    expect(html).toContain(`value="${challenge}"`);
    const anon = await call(`/_/auth/extension?challenge=${challenge}`, { as: null });
    expect(anon.headers.get("location")).toBe(`/_/auth/login?rd=${encodeURIComponent(`/_/auth/extension?challenge=${challenge}`)}`);
    expect((await call("/_/auth/extension?challenge=nope")).status).toBe(400);
  });

  it("issues a token that authenticates redirects and the API", async () => {
    const token = await connect();
    expect(token.startsWith("cairn_")).toBe(true);
    expect(await (await call("/_/api/me", bearer(token))).json()).toMatchObject({ email: "alice@example.com" });
    await call("/_/api/links", { method: "POST", body: { slug: "t", url: "https://t.test/" }, ...bearer(token) });
    expect((await call("/t", bearer(token))).headers.get("location")).toBe("https://t.test/");
    // Only a hash is stored.
    const rows = await env.DB.prepare("SELECT hash FROM extension_tokens").all<{ hash: string }>();
    expect(rows.results).toHaveLength(1);
    expect(rows.results[0]!.hash).not.toContain(token.slice(6));
  });

  it("needs the matching verifier, and refuses approval from another origin", async () => {
    const code = await approve("right");
    expect((await exchange(code, "wrong")).status).toBe(400);
    expect((await exchange(code, "")).status).toBe(400);
    expect((await exchange("garbage", "right")).status).toBe(400);
    expect((await call("/_/auth/extension", form(await sha("v"), "https://evil.test"))).status).toBe(403);
  });

  it("does not accept a session cookie as a code, or a code as a session", async () => {
    const { sessionCookie } = await import("./helpers");
    const session = (await sessionCookie("alice@example.com")).slice("cairn_session=".length);
    expect((await exchange(session, "v")).status).toBe(400);
    const code = await approve("v");
    expect((await call("/_/api/me", { as: null, headers: { cookie: `cairn_session=${code}` } })).status).toBe(401);
  });

  it("rejects unknown, expired and revoked tokens", async () => {
    expect((await call("/_/api/me", bearer("cairn_nope"))).status).toBe(401);
    expect((await call("/x", bearer("cairn_nope"))).headers.get("location")).toContain("/_/auth/login");

    const token = await connect();
    await env.DB.exec("UPDATE extension_tokens SET expires_at = 1");
    _resetTokenCache();
    expect((await call("/_/api/me", bearer(token))).status).toBe(401);

    const t2 = await connect();
    expect((await call("/_/api/tokens/current", { method: "DELETE", ...bearer(t2) })).status).toBe(200);
    expect((await call("/_/api/me", bearer(t2))).status).toBe(401);
  });

  it("lets people sign out everywhere, and admins sign others out", async () => {
    const a1 = await connect();
    const a2 = await connect();
    const bob = await connect("bob@example.com");

    const denied = await call("/_/api/tokens?email=alice@example.com", { method: "DELETE", as: "bob@example.com" });
    expect(denied.status).toBe(403);

    const mine = await call("/_/api/tokens", { method: "DELETE", ...bearer(a1), headers: { authorization: `Bearer ${a1}`, "x-cairn-request": "1" } });
    expect(await mine.json()).toEqual({ ok: true, revoked: 2 });
    expect((await call("/_/api/me", bearer(a2))).status).toBe(401);
    expect((await call("/_/api/me", bearer(bob))).status).toBe(200);

    const byAdmin = await call("/_/api/tokens?email=Bob@example.com", { method: "DELETE", as: "admin@example.com" });
    expect(await byAdmin.json()).toEqual({ ok: true, revoked: 1 });
    expect((await call("/_/api/me", bearer(bob))).status).toBe(401);
  });

  it("honours ALLOWED_EMAIL_DOMAINS for tokens", async () => {
    const token = await connect();
    expect((await call("/_/api/me", { ...bearer(token), env: { ALLOWED_EMAIL_DOMAINS: "corp.test" } })).status).toBe(403);
  });

  it("is switched off outside oidc mode", async () => {
    const res = await call("/_/auth/extension/token", { method: "POST", as: null, body: {}, env: { AUTH_MODE: "dev" }, origin: "http://localhost:8787" });
    expect(res.status).toBe(400);
  });
});
