#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const raw = Buffer.concat(chunks).toString("utf8");

function respond(body) {
  process.stdout.write(JSON.stringify(body));
}

let command = "";
try {
  command = JSON.parse(raw).command ?? "";
} catch {
  respond({
    permission: "deny",
    agent_message: "The push check received input it could not read.",
  });
  process.exit(0);
}

const pushing = /\b(?:jj(?:\s+git)?\s+push|git\s+push)\b/.test(command);
if (!pushing) {
  respond({ permission: "allow" });
  process.exit(0);
}

const check = spawnSync("node", ["scripts/pre-push-check.mjs", "--fix"], {
  encoding: "utf8",
});
if (check.stdout) process.stderr.write(check.stdout);
if (check.stderr) process.stderr.write(check.stderr);
if ((check.status ?? 1) !== 0) {
  respond({
    permission: "deny",
    user_message: "Push blocked until lint, format, types, and unit tests pass.",
    agent_message:
      "npm run check failed. Fix the errors above. If Prettier rewrote files, include those edits and push again.",
  });
  process.exit(0);
}

respond({ permission: "allow" });
