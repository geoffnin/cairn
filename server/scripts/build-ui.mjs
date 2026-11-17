// Builds the web UI (../web) into public/_/, which `wrangler deploy` uploads as static assets.
// Wrangler runs this before every deploy and `wrangler dev` (build.command in wrangler.jsonc),
// however they are started, so the UI is never missing or stale.
//
// Svelte and Vite are installed at the repository root. A fresh checkout, like the one the
// Deploy to Cloudflare button builds from, has none yet, so they are installed first.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const npm = (...args) => {
  const r = spawnSync("npm", args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) {
    console.error(`\nnpm ${args.join(" ")} failed (in ${root}); see the output above.`);
    process.exit(r.status ?? 1);
  }
};

if (!existsSync(`${root}/node_modules/.bin/vite`)) npm("ci");
npm("run", "build", "-w", "web");
