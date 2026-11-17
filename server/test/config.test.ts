import { describe, expect, it } from "vitest";
import { call } from "./helpers";

describe("server config", () => {
  it("publishes the prefix without sign-in", async () => {
    const res = await call("/_/config", { as: null });
    expect(await res.json()).toEqual({ name: "Cairn", prefix: "go", auth: "access" });
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
