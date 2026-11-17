import { describe, expect, it } from "vitest";
import { bundleCss } from "../src/assets";
import { call } from "./helpers";

describe("web UI styles", () => {
  it("links one fingerprinted stylesheet and allows only same-origin styles, fonts and images", async () => {
    const res = await call("/_/");
    const html = await res.text();
    const href = /<link rel="stylesheet" href="([^"]+)">/.exec(html)![1]!;
    expect(href).toMatch(/^\/_\/ui\/cairn\.css\?v=\w+$/);
    expect(html).toContain('<svg class="cn-mark"');
    const csp = res.headers.get("content-security-policy")!;
    expect(csp).toContain("style-src 'self'");
    expect(csp).toContain("font-src 'self'");
    expect(csp).toContain("img-src 'self'");
    expect(csp).not.toContain("unsafe-inline");

    const css = await call(href);
    expect(css.status).toBe(200);
    expect(css.headers.get("content-type")).toBe("text/css; charset=utf-8");
    expect(css.headers.get("cache-control")).toContain("immutable");
    const text = await css.text();
    expect(text).not.toMatch(/@import url/);
    expect(text).toMatch(/^@layer tokens, base, components;/m);
    for (const cls of [".cn-btn", ".cn-row", ".cn-gofield", ".cn-page::after"]) expect(text).toContain(cls);
  });

  it("serves every font and image the stylesheet refers to", async () => {
    const html = await (await call("/_/")).text();
    const href = /<link rel="stylesheet" href="([^"]+)">/.exec(html)![1]!;
    const css = await (await call(href)).text();
    const refs = [...css.matchAll(/url\("([^"]+)"\)/g)].map((m) => m[1]!);
    expect(refs).toContain("topo.svg");
    expect(refs.filter((r) => r.endsWith(".woff2"))).toHaveLength(6);
    for (const ref of refs) {
      const res = await call(`/_/ui/${ref}`);
      expect(res.status, ref).toBe(200);
      expect(res.headers.get("content-type"), ref).toBe(ref.endsWith(".woff2") ? "font/woff2" : "image/svg+xml");
      expect((await res.arrayBuffer()).byteLength, ref).toBeGreaterThan(1000);
    }
  });

  it("needs sign-in like everything else", async () => {
    expect((await call("/_/ui/cairn.css", { as: null })).status).toBe(401);
  });

  it("404s unknown UI files", async () => {
    expect((await call("/_/ui/nope.css")).status).toBe(404);
  });

  it("inlines imports in order and rewrites their relative URLs", () => {
    const out = bundleCss('@layer a;\n@import url("x.css");\n@import url("c/y.css");', {
      "x.css": 'a { b: url("f/z.woff2"); }',
      "c/y.css": 'p { q: url("../t.svg"), url("data:image/svg+xml,x"), url("https://e.test/u"); }',
    });
    expect(out).toBe('@layer a;\na { b: url("f/z.woff2"); }\np { q: url("t.svg"), url("data:image/svg+xml,x"), url("https://e.test/u"); }');
    expect(() => bundleCss('@import url("missing.css");', {})).toThrow(/missing\.css/);
  });
});
