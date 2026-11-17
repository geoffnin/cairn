// Turns design/tokens.json (exported from the Cairn design system) into ui/src/styles/tokens.css.
//
//   node design/build-tokens.mjs           write tokens.css
//   node design/build-tokens.mjs --check   exit 1 if tokens.css is out of date (CI)
//
// Colours become light-dark() pairs, so one declaration serves both themes and follows
// `color-scheme`: the OS by default, or data-theme="light" | "dark" on <html> to pin one.
// Other themed values (shadows) cannot use light-dark(), so they get a dark-theme block.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
export const SOURCE = here("./tokens.json");
export const OUTPUT = here("../ui/src/styles/tokens.css");

const themed = (v) => v !== null && typeof v === "object";
// "{moss}" refers to another colour token.
const ref = (v) => String(v).replace(/^\{([\w-]+)\}$/, "var(--$1)");

export function buildTokensCss(t) {
  const root = [];
  const dark = [];
  const line = (name, value) => root.push(`    --${name}: ${value};`);

  root.push("    /* Colour: light, dark */");
  for (const { name, value } of t.color.tokens) {
    if (!themed(value)) line(name, ref(value));
    else if (value.light === value.dark) line(name, ref(value.light));
    else line(name, `light-dark(${ref(value.light)}, ${ref(value.dark)})`);
  }

  root.push("", "    /* Type */");
  for (const [family, stack] of Object.entries(t.type.families)) line(`font-${family}`, stack);
  for (const group of t.type.groups) {
    for (const s of group.styles) {
      // Use as `font: var(--type-label)`; the family comes with it.
      line(`type-${s.name}`, `${s.fontWeight} ${s.fontSize}/${s.lineHeight} var(--font-${group.family})`);
      if (s.letterSpacing) line(`tracking-${s.name}`, s.letterSpacing);
    }
  }

  for (const [label, key] of [["Spacing", "spacing"], ["Radius", "radius"], ["Size", "size"], ["Shadow", "shadow"]]) {
    root.push("", `    /* ${label} */`);
    for (const { name, value } of t[key].tokens) {
      if (!themed(value)) line(name, value);
      else {
        line(name, value.light);
        dark.push(`--${name}: ${value.dark};`);
      }
    }
  }

  const darkDecls = (indent) => dark.map((d) => `${indent}${d}`).join("\n");
  return `/* Generated from design/tokens.json by design/build-tokens.mjs. Do not edit by hand. */
@layer tokens {
  :root {
    color-scheme: light dark;
${root.join("\n")}
  }
  :root[data-theme="light"] { color-scheme: light; }
  :root[data-theme="dark"] { color-scheme: dark; }

  /* Themed values that light-dark() cannot express. */
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
${darkDecls("      ")}
    }
  }
  :root[data-theme="dark"] {
${darkDecls("    ")}
  }
}
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const css = buildTokensCss(JSON.parse(readFileSync(SOURCE, "utf8")));
  if (process.argv.includes("--check")) {
    if (readFileSync(OUTPUT, "utf8") !== css) {
      console.error("ui/src/styles/tokens.css is out of date. Run: node design/build-tokens.mjs");
      process.exit(1);
    }
  } else {
    writeFileSync(OUTPUT, css);
    console.log("Wrote ui/src/styles/tokens.css");
  }
}
