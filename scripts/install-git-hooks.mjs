import { chmodSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

let hooksDir;
try {
  hooksDir = execSync("git rev-parse --git-path hooks", {
    encoding: "utf8",
  }).trim();
} catch {
  process.exit(0);
}

writeFileSync(
  `${hooksDir}/pre-push`,
  `#!/bin/sh
set -e
cd "$(git rev-parse --show-toplevel)"
npm run check
`,
);
chmodSync(`${hooksDir}/pre-push`, 0o755);
