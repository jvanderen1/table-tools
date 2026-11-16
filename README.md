# table-tools

Phone-friendly D&D (and other) **table play aids** — combat decision trees, trackers, cheat sheets — hosted on GitHub Pages so you can open them mid-session.

|                   |                                                                                          |
| ----------------- | ---------------------------------------------------------------------------------------- |
| Table             | [jvanderen1.github.io/table-tools](https://jvanderen1.github.io/table-tools/)            |
| Gary Grapplesauce | [combat tool](https://jvanderen1.github.io/table-tools/#/tools/gary-grapplesauce-combat) |
| Source            | [github.com/jvanderen1/table-tools](https://github.com/jvanderen1/table-tools)           |

Character and UI context for that tool: [`src/tools/gary-grapplesauce-combat/README.md`](./src/tools/gary-grapplesauce-combat/README.md).

## Use at the table

Open [the site](https://jvanderen1.github.io/table-tools/) on a phone. Each tool is a hash route, so it stays on one page and works after the app has been cached:

[Gary Grapplesauce](https://jvanderen1.github.io/table-tools/#/tools/gary-grapplesauce-combat)

### Offline and data safety

- A service worker (`vite-plugin-pwa`, `vite.config.ts`) precaches the app, icons, and fonts, so once opened it loads with no connection. `src/UpdatePrompt.tsx` checks for a new version on launch, every 30 minutes, and whenever the app returns to the foreground. If you haven’t tapped anything yet it reloads straight into the new version; otherwise a “New version ready · Reload” banner waits for you, so a reload never lands mid-fight. Saved data survives either way.
- Fonts are self-hosted (`@fontsource-variable/*`), no Google Fonts call.
- Tool state lives in `localStorage` under `table-tools:*`. The app asks the browser to keep it (`navigator.storage.persist()`), and the **Backup** button in the header saves/restores everything as a JSON file or text. Add the site to the Home Screen on iOS so Safari doesn’t clear it after a week unused.

## Develop

```bash
npm install
npm run dev
```

Checks run on every push and pull request (`.github/workflows/ci.yml`):

```bash
npm run lint          # oxlint
npm run format:check  # prettier
npx tsc -b            # strict TypeScript
npm test              # vitest unit tests
npm run test:e2e      # playwright use-case tests
npm run check         # lint, format, types, and unit tests
```

The first end-to-end run needs `npx playwright install chromium`.

This repo is **colocated Jujutsu + Git**. Prefer `jj` for day-to-day changes (`jj describe`, `jj new`). Push with `npm run push -- --bookmark main`. See [AGENTS.md](./AGENTS.md).

```bash
# first clone only — if you already have the git repo:
jj git init --colocate
```

## Add another Cursor-generated tool

```bash
npm run new-tool -- <kebab-case-id>
```

Then edit `src/tools/<id>/Tool.tsx` and `meta.ts`. Full notes in [AGENTS.md](./AGENTS.md).

## Publish

Pages is already on for this repo. A push to `main` runs [Check](https://github.com/jvanderen1/table-tools/actions/workflows/ci.yml), then [Deploy GitHub Pages](https://github.com/jvanderen1/table-tools/actions/workflows/pages.yml), which publishes [the site](https://jvanderen1.github.io/table-tools/).

```bash
npm run push -- --bookmark main
```

That formats, runs the same lint, format, typecheck, and unit tests as Check, then pushes. A raw `jj git push` or `git push` is blocked locally when that check fails.

The Pages build sets `BASE_PATH` from the repository name (`/table-tools/`). A fork with another name picks that up from the workflow. For a custom domain at the site root, build with `BASE_PATH=/`.

## Mirror on Cloudflare Pages (backup URL)

Optional second host, deployed from the same `main` pushes as a Worker with static assets (`wrangler.jsonc`). One-time setup in the Cloudflare dashboard:

1. **Workers & Pages → Create → Import a repository**, pick this repo.
2. Project name `table-tools` (must match `name` in `wrangler.jsonc`).
3. Build command `BASE_PATH=/ npm run build` (the site lives at the domain root there), deploy command `npx wrangler deploy`, preview command left as the default. Node comes from `.node-version`. Leave this command as-is: locally it runs Vite under Bun, and on GitHub Actions and Cloudflare (no Bun installed) it runs Vite under Node.

Each origin has its own `localStorage`, so use **Backup → Save backup file** on one and **Restore from file** on the other to move state.

## Stack

Vite · React · TypeScript · Tailwind · lucide-react · HashRouter (GitHub Pages friendly) · PWA (Workbox)
