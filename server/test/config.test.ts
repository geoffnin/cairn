import { describe, expect, it } from "vitest";
import { call } from "./helpers";

describe("fixed go/ prefix", () => {
  it("uses go/ in the UI and API messages", async () => {
    const html = await (await call("/_/")).text();
    expect(html).toContain('<span class="cn-gofield">');
    await call("/_/api/links", { method: "POST", body: { slug: "x", url: "https://a.test" } });
    const dup = await call("/_/api/links", { method: "POST", body: { slug: "x", url: "https://a.test" } });
    expect((await dup.json<{ error: string }>()).error).toBe("go/x already exists.");
  });

  it("no longer serves /_/config", async () => {
    expect((await call("/_/config")).status).toBe(404);
  });
});
