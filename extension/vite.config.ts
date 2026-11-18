import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig, type Plugin } from "vite";

// Builds the extension for one browser into dist/<target>/ (load that folder unpacked, or zip it
// to publish): `vite build` for Chrome and Edge, `vite build --mode firefox` for Firefox.
// public/ (icons, display.js, managed schema) is copied as is; manifest.json is written from the
// one in this folder, adjusted for the target. The pages and the service worker are entries;
// the service worker keeps the fixed name the manifest gives it.
type Target = "chrome" | "firefox";

const MANIFEST = fileURLToPath(new URL("manifest.json", import.meta.url));

/** The browser-specific parts of the manifest. Chrome's (and Edge's) is the file as written. */
function manifestFor(target: Target) {
  const m = JSON.parse(readFileSync(MANIFEST, "utf8"));
  if (target === "firefox") {
    delete m.minimum_chrome_version;
    // Firefox reads managed storage from its own policies.json and has no managed_schema.
    delete m.storage;
    // Firefox runs MV3 background scripts as an event page, not a service worker.
    m.background = { scripts: [m.background.service_worker], type: "module" };
    m.browser_specific_settings = {
      gecko: {
        // Permanent once on addons.mozilla.org; policies.json names the extension by it.
        id: "cairn@geoffnin.github.io",
        strict_min_version: "140.0",
        data_collection_permissions: { required: ["none"] },
      },
      // The first Firefox for Android that reads data_collection_permissions.
      gecko_android: { strict_min_version: "142.0" },
    };
  }
  return m;
}

const manifest = (target: Target): Plugin => ({
  name: "cairn-manifest",
  buildStart() {
    this.addWatchFile(MANIFEST);
  },
  generateBundle() {
    this.emitFile({ type: "asset", fileName: "manifest.json", source: `${JSON.stringify(manifestFor(target), null, 2)}\n` });
  },
});

export default defineConfig(({ mode }) => {
  const target: Target = mode === "firefox" ? "firefox" : "chrome";
  return {
    // Scoped-style class names from the CSS itself, not the file's path, so the build is the same
    // in every checkout (server/public/_/ is committed and checked in CI).
    plugins: [svelte({ compilerOptions: { cssHash: ({ hash, css }) => `svelte-${hash(css)}` } }), manifest(target)],
    define: { __TARGET__: JSON.stringify(target) },
    build: {
      outDir: `dist/${target}`,
      emptyOutDir: true,
      // Extension pages may not load data: URLs for scripts, and files are free here anyway.
      assetsInlineLimit: 0,
      target: target === "firefox" ? "firefox140" : "chrome123",
      // Readable output: the stores review it, and nothing is downloaded over a network.
      minify: false,
      rollupOptions: {
        input: {
          popup: "popup.html",
          links: "links.html",
          options: "options.html",
          go: "go.html",
          background: "background.js",
        },
        output: {
          entryFileNames: (chunk) => (chunk.name === "background" ? "background.js" : "assets/[name]-[hash].js"),
        },
      },
    },
  };
});
