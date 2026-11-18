// Starts the Worker for the end-to-end tests: `wrangler dev` (workerd, the production runtime)
// with its own local D1 and KV, emptied and migrated on every run. Playwright starts this
// (playwright.config.ts) and stops it when the tests finish.
//
// Cloudflare Access does not run locally, so the server runs in AUTH_MODE=dev; each test signs in
// as its own person with the X-Cairn-Dev-User header (see e2e/fixtures.ts).
import { spawn, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PORT = process.env.E2E_PORT ?? "8789";
const server = fileURLToPath(new URL("../server/", import.meta.url));
const wrangler = fileURLToPath(new URL("../server/node_modules/.bin/wrangler", import.meta.url));
const state = ".wrangler/e2e"; // apart from `npm run dev`'s own state in .wrangler/state
const env = { ...process.env, WRANGLER_SEND_METRICS: "false" };

rmSync(new URL(`../server/${state}`, import.meta.url), { recursive: true, force: true });
const migrate = spawnSync(wrangler, ["d1", "migrations", "apply", "DB", "--local", "--persist-to", state], {
  cwd: server,
  env,
  stdio: "inherit",
});
if (migrate.status !== 0) process.exit(migrate.status ?? 1);

const dev = spawn(
  wrangler,
  [
    "dev",
    "--port", PORT,
    "--persist-to", state,
    "--show-interactive-dev-session=false",
    "--var", "AUTH_MODE:dev",
    "--var", "ADMIN_EMAILS:admin@e2e.test",
    "--var", "ALLOWED_EMAIL_DOMAINS:e2e.test",
  ],
  { cwd: server, env, stdio: "inherit" },
);
for (const signal of /** @type {const} */ (["SIGINT", "SIGTERM"])) process.on(signal, () => dev.kill(signal));
dev.on("exit", (code) => process.exit(code ?? 0));
