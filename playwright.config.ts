// End-to-end tests: the web UI and the extension in Chromium, against the real Worker running
// locally under `wrangler dev` (e2e/server.mjs). Run with `npm run e2e`.
import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 8789);
const DEST_PORT = Number(process.env.DEST_PORT ?? 8790);

export default defineConfig({
  testDir: "e2e",
  // Tests share one server and database; each makes its own people and link names, so they
  // can run in parallel.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node e2e/server.mjs",
      url: `http://localhost:${PORT}/_/healthz`,
      env: { E2E_PORT: String(PORT) },
      // Wrangler builds the web UI before it starts.
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "node e2e/destination.mjs",
      url: `http://localhost:${DEST_PORT}/`,
      env: { DEST_PORT: String(DEST_PORT) },
      reuseExistingServer: !process.env.CI,
    },
  ],
});
