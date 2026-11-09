# table-tools

Phone-friendly D&D (and other) **table play aids** — combat decision trees, trackers, cheat sheets — hosted on GitHub Pages so you can open them mid-session.

First tool: **Gary Grapplesauce — combat tree**. Character and UI context for agents/humans: [`src/tools/gary-grapplesauce-combat/README.md`](./src/tools/gary-grapplesauce-combat/README.md).

## Use at the table

After Pages is enabled:

`https://<you>.github.io/table-tools/`

Hash routes work offline-friendly on phones:

`https://<you>.github.io/table-tools/#/tools/gary-grapplesauce-combat`

### Offline and data safety

- A service worker (`vite-plugin-pwa`, `vite.config.ts`) precaches the app, icons, and fonts, so once opened it loads with no connection. `src/UpdatePrompt.tsx` checks for a new version on launch, every 30 minutes, and whenever the app returns to the foreground. If you haven’t tapped anything yet it reloads straight into the new version; otherwise a “New version ready · Reload” banner waits for you, so a reload never lands mid-fight. Saved data survives either way.
- Fonts are self-hosted (`@fontsource-variable/*`), no Google Fonts call.
- Tool state lives in `localStorage` under `table-tools:*`. The app asks the browser to keep it (`navigator.storage.persist()`), and the **Backup** button in the header saves/restores everything as a JSON file or text. Add the site to the Home Screen on iOS so Safari doesn’t clear it after a week unused.

## Develop

```bash
npm install
npm run dev
```

This repo is **colocated Jujutsu + Git**. Prefer `jj` for day-to-day changes (`jj describe`, `jj new`, `jj git push`). See [AGENTS.md](./AGENTS.md).

```bash
# first clone only — if you already have the git repo:
jj git init --colocate
```

## Add another Cursor-generated tool

```bash
npm run new-tool -- <kebab-case-id>
```

Then edit `src/tools/<id>/Tool.tsx` and `meta.ts`. Full notes in [AGENTS.md](./AGENTS.md).

## Publish to GitHub

```bash
gh repo create table-tools --public --source=. --remote=origin --push
```

In the repo: **Settings → Pages → Source: GitHub Actions**.

The workflow in `.github/workflows/pages.yml` builds on every push to `main`.

If the repo name is not `table-tools`, set the Pages base when building:

```bash
BASE_PATH=/your-repo-name/ npm run build
```

(or change the default in `vite.config.ts` / the workflow `BASE_PATH` env).

## Mirror on Cloudflare Pages (backup URL)

Optional second host, deployed from the same `main` pushes as a Worker with static assets (`wrangler.jsonc`). One-time setup in the Cloudflare dashboard:

1. **Workers & Pages → Create → Import a repository**, pick this repo.
2. Project name `table-tools` (must match `name` in `wrangler.jsonc`).
3. Build command `BASE_PATH=/ npm run build` (the site lives at the domain root there), deploy command `npx wrangler deploy`, preview command left as the default. Node comes from `.node-version`. Leave this command as-is: locally it runs Vite under Bun, and on GitHub Actions and Cloudflare (no Bun installed) it runs Vite under Node.

Each origin has its own `localStorage`, so use **Backup → Save backup file** on one and **Restore from file** on the other to move state.

## Stack

Vite · React · TypeScript · Tailwind · lucide-react · HashRouter (GitHub Pages friendly) · PWA (Workbox)
