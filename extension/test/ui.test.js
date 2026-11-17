// The shared stylesheet (ui/) stays consistent with its sources.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { OUTPUT, SOURCE, buildTokensCss } from "../../design/build-tokens.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("ui/tokens.css is generated from design/tokens.json", () => {
  const want = buildTokensCss(JSON.parse(readFileSync(SOURCE, "utf8")));
  assert.equal(readFileSync(OUTPUT, "utf8"), want, "Run: node design/build-tokens.mjs");
});

test("every file cairn.css imports exists, and every url() it refers to", () => {
  const imports = [...read("ui/cairn.css").matchAll(/@import url\("([^"]+)"\);/g)].map((m) => m[1]);
  assert.ok(imports.length > 10);
  for (const path of imports) {
    const file = new URL(`../ui/${path}`, import.meta.url);
    assert.ok(existsSync(file), path);
    for (const [, ref] of readFileSync(file, "utf8").matchAll(/url\("([^"]+)"\)/g)) {
      assert.ok(existsSync(new URL(ref, file)), `${path} refers to ${ref}`);
    }
  }
});

test("the server bundles every stylesheet cairn.css imports", () => {
  const assets = readFileSync(new URL("../../server/src/assets.ts", import.meta.url), "utf8");
  for (const [, path] of read("ui/cairn.css").matchAll(/@import url\("([^"]+)"\);/g)) {
    assert.ok(assets.includes(`"${path}": `), `server/src/assets.ts is missing ${path}`);
  }
});

test("pages inline the mark exactly as ui/mark.svg has it", () => {
  const mark = read("ui/mark.svg").trim();
  for (const page of ["links.html", "options.html"]) assert.ok(read(page).includes(mark), page);
});

test("every page links the stylesheet and nothing uses the old class names", () => {
  for (const page of ["popup.html", "links.html", "options.html", "go.html"]) {
    const html = read(page);
    assert.ok(html.includes('<link rel="stylesheet" href="ui/cairn.css">'), page);
    assert.ok(html.includes('<script src="ui/display.js"></script>'), page);
  }
  for (const file of ["popup.js", "links.js", "options.js"]) {
    assert.doesNotMatch(read(file), /className: "(quiet|link)|\("err"|"warn"\)/, file);
  }
});
