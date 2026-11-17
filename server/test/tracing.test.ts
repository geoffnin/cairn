import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { _resetMemCache } from "../src/links";
import { _setTracer, type SpanAttributes } from "../src/tracing";
import { call, env } from "./helpers";

interface Recorded {
  name: string;
  attributes: SpanAttributes;
  exceptions: { name: string; message?: string }[];
}
let spans: Recorded[];

beforeEach(async () => {
  await env.DB.exec("DELETE FROM links");
  for (const k of (await env.CACHE.list()).keys) await env.CACHE.delete(k.name);
  _resetMemCache();
  spans = [];
  _setTracer({
    enterSpan(name, callback) {
      const rec: Recorded = { name, attributes: {}, exceptions: [] };
      spans.push(rec);
      return callback({
        setAttribute: (k, v) => void (rec.attributes[k] = v),
        setAttributes: (a) => void Object.assign(rec.attributes, a),
        recordException: (e) => void rec.exceptions.push(e),
      });
    },
  });
});
afterEach(() => _setTracer(null));

const named = (name: string) => spans.filter((s) => s.name === name).map((s) => s.attributes);

describe("custom spans", () => {
  it("records which cache layer answered each redirect", async () => {
    await call("/_/api/links", { method: "POST", body: { slug: "docs", url: "https://docs.test/" } });
    spans = [];
    await call("/docs"); // memory (filled by the create in this isolate)
    _resetMemCache();
    await call("/docs"); // KV (written by the create)
    await env.CACHE.delete("l:docs");
    _resetMemCache();
    await call("/docs"); // D1
    await call("/missing");
    expect(named("cairn.link.lookup")).toEqual([
      { "link.slug": "docs", "cache.layer": "memory", "link.found": true },
      { "link.slug": "docs", "cache.layer": "kv", "link.found": true },
      { "link.slug": "docs", "cache.layer": "d1", "link.found": true },
      { "link.slug": "missing", "cache.layer": "d1", "link.found": false },
    ]);
  });

  it("records how people signed in", async () => {
    await call("/_/api/me");
    await call("/_/api/me", { as: null, workerAccess: { email: "w@example.com" }, headers: { "cf-access-jwt-assertion": "t-1" } });
    await call("/_/api/me", { as: null, workerAccess: { email: "w@example.com" }, headers: { "cf-access-jwt-assertion": "t-1" } });
    expect(named("cairn.auth")).toEqual([
      { "auth.method": "access_jwt" },
      { "auth.method": "worker_access", "auth.identity_cached": false },
      { "auth.method": "worker_access", "auth.identity_cached": true },
    ]);
  });

  it("records API calls by route and status, not by link name", async () => {
    await call("/_/api/links", { method: "POST", body: { slug: "x", url: "https://x.test/" } });
    await call("/_/api/links/x", { method: "PUT", body: { url: "https://y.test/" }, as: "bob@example.com" });
    await call("/_/api/links/x");
    expect(named("cairn.api")).toEqual([
      { "http.method": "POST", "cairn.api.route": "/links", "http.status_code": 201 },
      { "http.method": "PUT", "cairn.api.route": "/links/:slug", "http.status_code": 403 },
      { "http.method": "GET", "cairn.api.route": "/links/:slug", "http.status_code": 200 },
    ]);
  });

  it("records failures as exceptions on the span", async () => {
    const res = await call("/_/api/me", { as: null, env: { ACCESS_TEAM_DOMAIN: "", ACCESS_AUD: "" } });
    expect(res.status).toBe(401);
    expect(spans.find((s) => s.name === "cairn.auth")?.exceptions).toMatchObject([{ name: "Error", message: expect.stringMatching(/Not signed in/) }]);
  });

  it("never puts an email in a span", async () => {
    await call("/_/api/links", { method: "POST", body: { slug: "pii", url: "https://a.test/" } });
    await call("/_/api/links/pii", { method: "PUT", body: { owner: "bob@example.com" } });
    await call("/pii");
    await call("/_/api/me", { as: null, workerAccess: { email: "w@example.com" } });
    expect(spans.length).toBeGreaterThan(4);
    expect(JSON.stringify(spans)).not.toMatch(/@/);
  });
});
