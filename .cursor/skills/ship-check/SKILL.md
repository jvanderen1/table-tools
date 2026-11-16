---
name: ship-check
description: >-
  Run before describing a change, committing, or pushing table-tools. Matches
  the GitHub Check workflow (lint, Prettier, types, unit tests) so a push is
  not rejected. Use when finishing work, running jj describe, jj git push, or
  npm run push.
---

# Ship check

`jj git push` does not run Git hooks, so Husky would not see a Jujutsu push. The gate is `node scripts/pre-push-check.mjs --fix`, which formats, then runs `npm run check` (lint, format check, `tsc -b`, unit tests).

Before `jj git push` or `npm run push`:

1. Run `node scripts/pre-push-check.mjs --fix`.
2. If it fails, fix the reported errors. Include any files Prettier rewrote.
3. Push only after it exits 0. A Cursor hook also runs this check and blocks `jj git push` and `git push` when it fails.

End-to-end tests stay on GitHub Actions (`npm run test:e2e`). Run them locally when the change touches the UI.

Describe the change, move `main` to `@`, then push with `npm run push -- --bookmark main`.
