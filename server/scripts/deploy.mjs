// `npm run deploy`, also what the Deploy to Cloudflare button runs.
//
// Migrations go first when the database already exists, so new code never runs against an old
// schema. On a first install the database does not exist until `wrangler deploy` creates it, so
// then the order is deploy, then migrate.
//
// Accepts one option, --dry-run (npm run deploy -- --dry-run): it builds and checks the Worker
// with `wrangler deploy --dry-run` and touches nothing remote, migrations included. Any other
// argument is refused before anything runs, rather than silently ignored.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const unknown = args.filter((a) => a !== "--dry-run");
if (unknown.length) {
  console.error(`Unsupported option(s): ${unknown.join(" ")}. Only --dry-run is accepted; run wrangler directly for anything else.`);
  process.exit(2);
}
const dryRun = args.includes("--dry-run");

const wrangler = (...args) => {
  const r = spawnSync("npx", ["wrangler", ...args], { encoding: "utf8", stdio: ["inherit", "pipe", "pipe"] });
  process.stdout.write(r.stdout ?? "");
  process.stderr.write(r.stderr ?? "");
  return { ok: r.status === 0, output: `${r.stdout}\n${r.stderr}` };
};
const migrate = () => wrangler("d1", "migrations", "apply", "DB", "--remote");
const deploy = () => wrangler("deploy");
const fail = (step) => {
  console.error(`\n${step} failed; see the output above.`);
  process.exit(1);
};

// The web UI is static files built from ../web into public/_/, which the deploy uploads. Its
// tools are installed at the repository root; the Deploy to Cloudflare button starts without them.
const root = fileURLToPath(new URL("../..", import.meta.url));
const npm = (...args) => spawnSync("npm", args, { cwd: root, stdio: "inherit" }).status === 0;
if (!existsSync(`${root}/node_modules`) && !npm("ci")) fail("Installing the web UI's build tools");
if (!npm("run", "build", "-w", "web")) fail("Building the web UI");

if (dryRun) {
  console.log("Dry run: checking the build only. No migrations, no deploy.\n");
  process.exit(wrangler("deploy", "--dry-run").ok ? 0 : 1);
}

const first = migrate();
if (first.ok) {
  if (!deploy().ok) fail("Deploy");
} else if (/Couldn't find an auto-provisioned D1 DB|Couldn't find a D1 DB/.test(first.output)) {
  console.log("\nNo database yet: deploying first so Wrangler can create it, then applying migrations.\n");
  if (!deploy().ok) fail("Deploy");
  if (!migrate().ok) fail("Applying migrations");
} else {
  fail("Applying migrations");
}
