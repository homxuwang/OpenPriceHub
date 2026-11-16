import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const mode = process.argv[2];
if (!["--local", "--remote"].includes(mode))
  throw new Error("Choose --local or --remote explicitly.");
if (mode === "--remote") {
  const extra=process.argv.slice(3);
  // Remote deployments use one validated local configuration; arbitrary DB names are no longer accepted.
  if(extra.some(x=>x!=="--apply"))throw new Error("Remote DB is selected in config/cloudflare.local.json. Use npm run cf:migrate -- --apply.");
  const result=spawnSync(process.execPath,[fileURLToPath(new URL("./cloudflare.mjs",import.meta.url)),"migrate",...extra],{stdio:"inherit"});
  process.exit(result.status ?? 1);
}
const database = process.argv[3] || "ai-price-compare";
const wrangler = fileURLToPath(
  new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url),
);
function run(args) {
  const result = spawnSync(process.execPath, [wrangler, ...args], {
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
run([
  "d1",
  "execute",
  database,
  mode,
  "--file=migrations/bootstrap/adopt_legacy.sql",
]);
run(["d1", "migrations", "apply", database, mode]);
