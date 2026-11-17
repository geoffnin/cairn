// Storybook for the shared UI (ui/src). `npm run storybook` to browse; `npm test` also runs every
// story as a browser test (see vitest.config.ts), including its play function and an a11y check.
import { svelte } from "@sveltejs/vite-plugin-svelte";
import type { StorybookConfig } from "@storybook/svelte-vite";

const config: StorybookConfig = {
  framework: "@storybook/svelte-vite",
  stories: ["../ui/src/**/*.stories.svelte"],
  addons: ["@storybook/addon-svelte-csf", "@storybook/addon-a11y", "@storybook/addon-vitest"],
  core: { disableTelemetry: true },
  // There is no vite.config at the root (each app has its own), so add Svelte here.
  viteFinal: (config) => ({ ...config, plugins: [svelte(), ...(config.plugins ?? [])] }),
};
export default config;
