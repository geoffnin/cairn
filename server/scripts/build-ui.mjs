// Builds the web UI (../web) into public/_/, which `wrangler deploy` uploads as static assets.
// Wrangler runs this before every deploy and `wrangler dev` (build.command in wrangler.jsonc).
//
// public/_/ is also committed, because the Deploy to Cloudflare button copies only this
// server/ folder into the installer's new repository: there, ../web and ../ui do not exist, so
// the committed build is used as it is. CI fails if the committed build is out of date.
//
// In a full checkout, Svelte and Vite come from the repository root. A fresh checkout has none
// yet, so only what the web build needs is installed first (not the root's test tools).
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const server = fileURLToPath(new URL("..", import.meta.url));

if (!existsSync(`${root}/web/package.json`) || !existsSync(`${root}/ui/package.json`)) {
  if (!existsSync(`${server}/public/_/index.html`)) {
    console.error("No web UI source (../web) and no committed build (public/_/index.html); cannot deploy the UI.");
    process.exit(1);
  }
  console.log("Using the committed web UI build in public/_/ (no ../web source here).");
  process.exit(0);
}

const npm = (...args) => {
  const r = spawnSync("npm", args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) {
    console.error(`\nnpm ${args.join(" ")} failed (in ${root}); see the output above.`);
    process.exit(r.status ?? 1);
  }
};

if (!existsSync(`${root}/node_modules/.bin/vite`)) npm("ci", "--workspace", "web");
npm("run", "build", "-w", "web");
