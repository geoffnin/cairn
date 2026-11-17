// `npm run deploy`, also what the Deploy to Cloudflare button runs.
//
// Migrations go first when the database already exists, so new code never runs against an old
// schema. On a first install the database does not exist until `wrangler deploy` creates it, so
// then the order is deploy, then migrate.
import { spawnSync } from "node:child_process";

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
