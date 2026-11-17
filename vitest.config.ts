// Unit and component tests for the shared UI (ui/src). The Worker's tests run in server/ under
// the Workers runtime; the extension's link rules under node --test in extension/.
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { svelteTesting } from "@testing-library/svelte/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [svelte(), svelteTesting()],
  test: {
    environment: "jsdom",
    include: ["ui/src/**/*.test.ts"],
  },
});
