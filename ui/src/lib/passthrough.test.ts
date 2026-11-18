import { describe, expect, it } from "vitest";
import { fillPassThrough, passThroughExamples, suggestPassThrough } from "./passthrough";

describe("pass-through", () => {
  it("offers the ID at the end of a page's path", () => {
    expect(suggestPassThrough("https://docs.example.com/rfcs/0042")).toEqual({ template: "https://docs.example.com/rfcs/{*}", token: "0042" });
    expect(suggestPassThrough("https://tracker.example.com/browse/ABC-12/?tab=x")).toEqual({ template: "https://tracker.example.com/browse/{*}/", token: "ABC-12" });
  });

  it("offers nothing without an ID, or when {*} is already there", () => {
    expect(suggestPassThrough("https://docs.example.com/rfcs/index")).toBeNull();
    expect(suggestPassThrough("https://docs.example.com/planning/q4-planning")).toBeNull();
    expect(suggestPassThrough("https://docs.example.com/v2")).toBeNull();
    expect(suggestPassThrough("https://docs.example.com/")).toBeNull();
    expect(suggestPassThrough("https://docs.example.com/rfcs/{*}")).toBeNull();
  });

  it("fills and explains the template", () => {
    expect(fillPassThrough("https://x.example.com/{*}", "7")).toBe("https://x.example.com/7");
    expect(fillPassThrough("https://x.example.com/{*}", "$&")).toBe("https://x.example.com/$&");
    expect(passThroughExamples("rfc", "https://docs.example.com/rfcs/{*}", "0042")).toEqual({ mine: "rfc/0042", other: "rfc/7", otherDest: "…/rfcs/7" });
  });
});
