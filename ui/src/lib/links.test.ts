import { describe, expect, it } from "vitest";
import { goNameSegments, splitDestination } from "./links";

describe("goNameSegments", () => {
  it("picks out go/ names and leaves the sentence's punctuation", () => {
    expect(goNameSegments("Created go/wiki.")).toEqual([{ text: "Created " }, { name: "wiki" }, { text: "." }]);
    expect(goNameSegments("go/a-b_c.d already exists")).toEqual([{ name: "a-b_c.d" }, { text: " already exists" }]);
    expect(goNameSegments("Saved go/x and go/y")).toEqual([{ text: "Saved " }, { name: "x" }, { text: " and " }, { name: "y" }]);
  });

  it("ignores text that only looks similar", () => {
    expect(goNameSegments("Choose where your go/ links live.")).toEqual([{ text: "Choose where your go/ links live." }]);
    expect(goNameSegments("ergo/x")).toEqual([{ text: "ergo/x" }]);
    expect(goNameSegments("")).toEqual([]);
  });
});

describe("splitDestination", () => {
  it("drops the scheme and splits off the host", () => {
    expect(splitDestination("https://docs.example.com/a/b?c#d")).toEqual({ host: "docs.example.com", rest: "/a/b?c#d" });
    expect(splitDestination("http://x.test")).toEqual({ host: "x.test", rest: "" });
    expect(splitDestination("https://tracker.example.com/browse/{*}")).toEqual({ host: "tracker.example.com", rest: "/browse/{*}" });
  });

  it("returns null for anything that is not http(s)", () => {
    expect(splitDestination("ftp://x.test/a")).toBeNull();
    expect(splitDestination("not a url")).toBeNull();
  });
});
