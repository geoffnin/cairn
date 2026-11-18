import { svelte } from "@sveltejs/vite-plugin-svelte";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const page = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// Three static pages. A relative base, so the site works wherever it is hosted: at the root of a
// domain, or under /cairn/ on GitHub Pages.
export default defineConfig({
  base: "./",
  plugins: [svelte()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    assetsInlineLimit: 0,
    target: "es2022",
    rollupOptions: {
      input: {
        home: page("index.html"),
        extension: page("extension/index.html"),
        server: page("server/index.html"),
      },
    },
  },
});
