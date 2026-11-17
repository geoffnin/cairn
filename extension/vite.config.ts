import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

// Builds the extension into dist/ (load that folder unpacked, or zip it to publish). public/
// (manifest, icons, display.js) is copied as is. The pages and the service worker are entries;
// the service worker keeps the fixed name the manifest gives it.
export default defineConfig({
  // Scoped-style class names from the CSS itself, not the file's path, so the build is the same
  // in every checkout (server/public/_/ is committed and checked in CI).
  plugins: [svelte({ compilerOptions: { cssHash: ({ hash, css }) => `svelte-${hash(css)}` } })],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Extension pages may not load data: URLs for scripts, and files are free here anyway.
    assetsInlineLimit: 0,
    target: "chrome123",
    // Readable output: the Chrome Web Store reviews it, and nothing is downloaded over a network.
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
});
