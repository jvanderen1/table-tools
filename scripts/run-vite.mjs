import { spawnSync } from "node:child_process";

/**
 * Run Vite on Bun when `bun` is installed, and on Node otherwise.
 * GitHub Actions and Cloudflare call `npm run build` on Node images that
 * do not have Bun, so the fallback keeps those deploys on the same command.
 */
const args = process.argv.slice(2);
const bun = spawnSync("bun", ["--version"], { stdio: "ignore" });
const useBun = bun.status === 0;

const result = useBun
  ? spawnSync("bunx", ["--bun", "vite", ...args], { stdio: "inherit" })
  : spawnSync("vite", args, { stdio: "inherit" });

process.exit(result.status ?? 1);
