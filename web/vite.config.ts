import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

// Builds into the Worker's static assets folder (assets.directory in server/wrangler.jsonc).
// Everything lives under /_/, where no link name can start.
export default defineConfig({
  base: "/_/",
  // Scoped-style class names from the CSS itself, not the file's path, so the build is the same
  // in every checkout (server/public/_/ is committed and checked in CI).
  plugins: [svelte({ compilerOptions: { cssHash: ({ hash, css }) => `svelte-${hash(css)}` } })],
  build: {
    outDir: "../server/public/_",
    emptyOutDir: true,
    // Fonts and images as files, never data: URLs, so the page's CSP can stay 'self'.
    assetsInlineLimit: 0,
    target: "es2022",
  },
  server: {
    // `npm run dev` here, with `npm run dev` in server/ (port 8787) for the API.
    proxy: {
      "/_/api": { target: "http://localhost:8787", changeOrigin: true, headers: { origin: "http://localhost:8787" } },
      "/_/auth": "http://localhost:8787",
    },
  },
});
