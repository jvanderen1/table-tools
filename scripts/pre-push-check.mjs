import { spawnSync } from "node:child_process";

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
}

if (process.argv.includes("--fix")) run("npm", ["run", "format"]);
run("npm", ["run", "check"]);
