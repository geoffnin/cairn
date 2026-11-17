import { describe, expect, it } from "vitest";
import { call } from "./helpers";

describe("fixed go/ prefix", () => {
  it("uses go/ in API messages", async () => {
    await call("/_/api/links", { method: "POST", body: { slug: "x", url: "https://a.test" } });
    const dup = await call("/_/api/links", { method: "POST", body: { slug: "x", url: "https://a.test" } });
    expect((await dup.json<{ error: string }>()).error).toBe("go/x already exists.");
  });

  it("no longer serves /_/config", async () => {
    expect((await call("/_/config")).status).toBe(404);
  });
});
