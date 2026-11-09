# table-tools

Phone-friendly D&D (and other) **table play aids** — combat decision trees, trackers, cheat sheets — hosted on GitHub Pages so you can open them mid-session.

First tool: **Gary Grapplesauce — combat tree**.

## Use at the table

After Pages is enabled:

`https://<you>.github.io/table-tools/`

Hash routes work offline-friendly on phones:

`https://<you>.github.io/table-tools/#/tools/gary-grapplesauce-combat`

## Develop

```bash
npm install
npm run dev
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

## Stack

Vite · React · TypeScript · HashRouter (GitHub Pages friendly)
