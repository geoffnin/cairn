// Two test projects for the shared UI (ui/src):
// - unit: unit and component tests (*.test.ts) in jsdom.
// - storybook: every story in ui/src renders in a real browser (Chromium, via Playwright), runs
//   its play function and passes an accessibility check. `npx playwright install chromium` once.
// The Worker's tests run in server/ under the Workers runtime; the extension's link rules under
// node --test in extension/.
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { svelteTesting } from "@testing-library/svelte/vite";
import { playwright } from "@vitest/browser-playwright";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [svelte(), svelteTesting()],
        test: {
          name: "unit",
          environment: "jsdom",
          include: ["ui/src/**/*.test.ts"],
        },
      },
      {
        plugins: [storybookTest({ configDir: fileURLToPath(new URL(".storybook", import.meta.url)) })],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
