// Same cases as server/test/links.test.ts, so local links behave like server links.
import assert from "node:assert/strict";
import { test } from "node:test";
import { ValidationError, normalizeSlug, omniboxPath, parseGoPath, resolveTarget, validateUrl } from "../golinks.js";

test("resolveTarget matches the server", () => {
  const cases = [
    ["https://a.test/x", "", "", "https://a.test/x"],
    ["https://a.test/x", "y/z", "", "https://a.test/x/y/z"],
    ["https://a.test/x/", "y", "?a=1", "https://a.test/x/y?a=1"],
    ["https://a.test/x?k=v", "", "?a=1", "https://a.test/x?k=v&a=1"],
    ["https://a.test/browse/{*}", "ABC-12", "", "https://a.test/browse/ABC-12"],
    ["https://a.test/browse/{*}", "", "", "https://a.test/browse/"],
    ["https://a.test/s?q={*}", "a%20b&c=d/e", "", "https://a.test/s?q=a%20b%26c%3Dd%2Fe"],
    ["https:a.test", "", "", "https://a.test/"],
    ["https://a.test/文档", "", "", "https://a.test/%E6%96%87%E6%A1%A3"],
  ];
  for (const [target, rest, search, want] of cases) assert.equal(resolveTarget(target, rest, search), want, `${target} + ${rest}`);
});

test("parseGoPath splits slug, rest and query", () => {
  assert.deepEqual(parseGoPath("Docs"), { slug: "docs", rest: "", search: "" });
  assert.deepEqual(parseGoPath("bug/ABC-12?x=1&y=%20z"), { slug: "bug", rest: "ABC-12", search: "?x=1&y=%20z" });
  assert.deepEqual(parseGoPath("a%2Eb/c/d"), { slug: "a.b", rest: "c/d", search: "" });
  assert.deepEqual(parseGoPath(""), { slug: "", rest: "", search: "" });
  assert.deepEqual(parseGoPath("%E0%A4%A"), { slug: "%e0%a4%a", rest: "", search: "" });
});

test("validation matches the server", () => {
  assert.equal(normalizeSlug("  Wiki "), "wiki");
  for (const bad of ["_x", "a b", "", "x".repeat(65)]) assert.throws(() => normalizeSlug(bad), ValidationError, bad);
  assert.equal(validateUrl("https://t.test/{*}"), "https://t.test/{*}");
  for (const bad of ["javascript:alert(1)", "not a url", "", "data:text/html,hi"]) assert.throws(() => validateUrl(bad), ValidationError, bad);
});

test("omniboxPath keeps separators and turns spaces into slashes", () => {
  assert.equal(omniboxPath("jira ABC-1"), "jira/ABC-1");
  assert.equal(omniboxPath("  bug/ABC-12?x=1&y=2 "), "bug/ABC-12?x=1&y=2");
  assert.equal(omniboxPath("search a%20b"), "search/a%20b");
  assert.equal(omniboxPath("wiki 100%"), "wiki/100%25");
  assert.equal(omniboxPath("doc #3"), "doc/%233");
  assert.equal(omniboxPath("docs 文档"), "docs/%E6%96%87%E6%A1%A3");
  // Round trip: what the resolver sees matches what was typed.
  assert.deepEqual(parseGoPath(omniboxPath("bug/ABC-12?x=1")), { slug: "bug", rest: "ABC-12", search: "?x=1" });
});
