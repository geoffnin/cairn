// The web UI's static files (built from ../web by `npm test`) behind the Worker.
import { describe, expect, it } from "vitest";
import { call } from "./helpers";

async function page() {
  const res = await call("/_/");
  const html = await res.text();
  const script = /<script type="module" crossorigin src="([^"]+)">/.exec(html)?.[1];
  const style = /<link rel="stylesheet" crossorigin href="([^"]+)">/.exec(html)?.[1];
  return { res, html, script: script!, style: style! };
}

describe("web UI", () => {
  it("serves the page with a strict CSP and no caching", async () => {
    const { res, script, style } = await page();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^text\/html/);
    expect(res.headers.get("cache-control")).toBe("private, no-cache");
    const csp = res.headers.get("content-security-policy")!;
    for (const d of ["default-src 'none'", "script-src 'self'", "style-src 'self'", "font-src 'self'", "img-src 'self'", "frame-ancestors 'none'"]) {
      expect(csp).toContain(d);
    }
    expect(csp).not.toMatch(/unsafe|nonce|data:/);
    expect(script).toMatch(/^\/_\/assets\/.+\.js$/);
    expect(style).toMatch(/^\/_\/assets\/.+\.css$/);
  });

  it("serves the hashed script, stylesheet and everything the stylesheet refers to, cached for good", async () => {
    const { script, style } = await page();
    const css = await (await call(style)).text();
    const refs = [...css.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1]!.replace(/^["']|["']$/g, "")).filter((r) => !r.startsWith("data:"));
    expect(refs.filter((r) => r.endsWith(".woff2"))).toHaveLength(6);
    expect(refs.some((r) => /topo.*\.svg$/.test(r))).toBe(true);
    for (const path of [script, style, ...refs]) {
      const res = await call(path);
      expect(res.status, path).toBe(200);
      expect(res.headers.get("cache-control"), path).toBe("private, max-age=31536000, immutable");
      await res.arrayBuffer();
    }
  });

  it("needs sign-in like everything else", async () => {
    const { script } = await page();
    expect((await call("/_/", { as: null })).status).toBe(401);
    expect((await call(script, { as: null })).status).toBe(401);
  });

  it("refuses writes and 404s unknown files", async () => {
    expect((await call("/_/", { method: "POST" })).status).toBe(405);
    expect((await call("/_/nope.js")).status).toBe(404);
    expect((await call("/_/assets/nope.js")).status).toBe(404);
  });
});

describe("authentication landing page", () => {
  const path = "/_/auth/complete/";
  it("serves a script-free confirmation only after authentication", async () => {
    const response = await call(path);
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("You’re signed in to Cairn");
    expect(html).not.toContain("<script");
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(response.headers.get("cache-control")).toBe("private, no-cache");
    expect((await call(path, { as: null })).status).toBe(401);
    expect((await call(path, { method: "POST" })).status).toBe(405);
  });
});
