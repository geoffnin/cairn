// The web UI's stylesheet, fonts and contour image, served under /_/ui/.
//
// They live in extension/ui, because the extension must ship them inside its own folder, and are
// shared from there so the two UIs cannot drift. Wrangler bundles them into the Worker as text
// and binary modules ("rules" in wrangler.jsonc); nothing is fetched from elsewhere at runtime.
import entry from "../../extension/ui/cairn.css";
import base from "../../extension/ui/base.css";
import fonts from "../../extension/ui/fonts.css";
import tokens from "../../extension/ui/tokens.css";
import button from "../../extension/ui/components/button.css";
import card from "../../extension/ui/components/card.css";
import checkbox from "../../extension/ui/components/checkbox.css";
import dialog from "../../extension/ui/components/dialog.css";
import emptyState from "../../extension/ui/components/empty-state.css";
import field from "../../extension/ui/components/field.css";
import goName from "../../extension/ui/components/go-name.css";
import header from "../../extension/ui/components/header.css";
import linkTable from "../../extension/ui/components/link-table.css";
import modeOption from "../../extension/ui/components/mode-option.css";
import page from "../../extension/ui/components/page.css";
import segmented from "../../extension/ui/components/segmented.css";
import status from "../../extension/ui/components/status.css";
import mono400 from "../../extension/ui/fonts/ibm-plex-mono-latin-400-normal.woff2";
import mono500 from "../../extension/ui/fonts/ibm-plex-mono-latin-500-normal.woff2";
import mono600 from "../../extension/ui/fonts/ibm-plex-mono-latin-600-normal.woff2";
import sans400 from "../../extension/ui/fonts/instrument-sans-latin-400-normal.woff2";
import sans500 from "../../extension/ui/fonts/instrument-sans-latin-500-normal.woff2";
import sans600 from "../../extension/ui/fonts/instrument-sans-latin-600-normal.woff2";
import mark from "../../extension/ui/mark.svg";
import topo from "../../extension/ui/topo.svg";

const STYLESHEETS: Record<string, string> = {
  "tokens.css": tokens,
  "fonts.css": fonts,
  "base.css": base,
  "components/button.css": button,
  "components/card.css": card,
  "components/checkbox.css": checkbox,
  "components/dialog.css": dialog,
  "components/empty-state.css": emptyState,
  "components/field.css": field,
  "components/go-name.css": goName,
  "components/header.css": header,
  "components/link-table.css": linkTable,
  "components/mode-option.css": modeOption,
  "components/page.css": page,
  "components/segmented.css": segmented,
  "components/status.css": status,
};

/**
 * Inlines cairn.css's @imports, in its order, into one stylesheet. Relative url()s are rewritten
 * to resolve from the entry's folder, as they did from the imported file's.
 */
export function bundleCss(css: string, files: Record<string, string>): string {
  return css.replace(/@import url\("([^"]+)"\);/g, (_, path: string) => {
    const imported = files[path];
    if (imported === undefined) throw new Error(`cairn.css imports ${path}, which server/src/assets.ts does not bundle`);
    return imported.replace(/url\("([^"]+)"\)/g, (whole, ref: string) =>
      /^[a-z][a-z0-9+.-]*:/i.test(ref) ? whole : `url("${new URL(ref, `https://ui.invalid/${path}`).pathname.slice(1)}")`,
    );
  });
}

// FNV-1a: a stable fingerprint for the stylesheet URL, so browsers can cache it for good.
function fingerprint(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}

const CSS = bundleCss(entry, STYLESHEETS);
export const STYLESHEET_URL = `/_/ui/cairn.css?v=${fingerprint(CSS)}`;
/** The Cairn mark, to inline as <svg class="cn-mark"> so its faces bind to the brand tokens. */
export const MARK_SVG = mark.trim();

const FILES: Record<string, { body: string | ArrayBuffer; type: string }> = {
  "/_/ui/cairn.css": { body: CSS, type: "text/css; charset=utf-8" },
  "/_/ui/topo.svg": { body: topo, type: "image/svg+xml" },
  "/_/ui/fonts/instrument-sans-latin-400-normal.woff2": { body: sans400, type: "font/woff2" },
  "/_/ui/fonts/instrument-sans-latin-500-normal.woff2": { body: sans500, type: "font/woff2" },
  "/_/ui/fonts/instrument-sans-latin-600-normal.woff2": { body: sans600, type: "font/woff2" },
  "/_/ui/fonts/ibm-plex-mono-latin-400-normal.woff2": { body: mono400, type: "font/woff2" },
  "/_/ui/fonts/ibm-plex-mono-latin-500-normal.woff2": { body: mono500, type: "font/woff2" },
  "/_/ui/fonts/ibm-plex-mono-latin-600-normal.woff2": { body: mono600, type: "font/woff2" },
};

export function serveUiFile(req: Request, path: string): Response {
  const file = FILES[path];
  if (!file) return new Response("Not found", { status: 404 });
  // The stylesheet's URL changes with its content; the rest change only with a font or the image.
  const versioned = path === "/_/ui/cairn.css" && new URL(req.url).searchParams.has("v");
  return new Response(file.body, {
    headers: {
      "content-type": file.type,
      // private: every response sits behind Cloudflare Access, so shared caches must not keep it.
      "cache-control": versioned ? "private, max-age=31536000, immutable" : "private, max-age=86400",
      "x-content-type-options": "nosniff",
    },
  });
}
