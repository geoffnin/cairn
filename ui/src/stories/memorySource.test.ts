import { describe, expect, it } from "vitest";
import { memorySource } from "./memorySource";

describe("memorySource (stories only)", () => {
  it("keeps a link you just made under Only mine, and others' links out", async () => {
    const source = memorySource([{ slug: "bob", url: "https://b.example.com/", description: "", owner: "bob@example.com" }], true, "alice@example.com");
    await source.create({ slug: "alice", url: "https://a.example.com/", description: "" });
    expect((await source.list({ q: "", mine: true })).map((l) => l.slug)).toEqual(["alice"]);
    expect((await source.list({ q: "", mine: false })).map((l) => l.slug)).toEqual(["alice", "bob"]);
  });

  it("leaves links in this browser without an owner", async () => {
    const source = memorySource([], false, "alice@example.com");
    expect((await source.create({ slug: "x", url: "https://x.example.com/", description: "" })).owner).toBeUndefined();
  });
});
