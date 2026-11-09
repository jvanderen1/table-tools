# Agent guide — adding a table tool

This repo hosts **multiple phone-friendly play aids** (combat trees, trackers, cheat sheets) on GitHub Pages.

Cursor canvases do **not** deploy here. Port interactive tools into React under `src/tools/<id>/`.

## Add a new tool (fast path)

```bash
npm run new-tool -- my-character-combat
npm run dev
```

That scaffolds:

- `src/tools/<id>/meta.ts` — title, summary, tags
- `src/tools/<id>/Tool.tsx` — UI
- a registry entry in `src/tools/registry.ts`

Then implement `Tool.tsx`. Prefer:

- shared UI from `src/ui`
- `usePersistentState` for trackers (Moxie, spell slots, etc.)
- short labels, big tap targets, no login

## Conventions

| Piece | Rule |
|---|---|
| `id` | kebab-case, stable URL slug |
| Home card | filled from `meta` only |
| Routing | automatic via registry + `/#/tools/<id>` |
| Persistence keys | `table-tools:<tool-id>:<name>` |

## Do not

- Put tools only in Cursor `.canvas.tsx` files — those stay local to Cursor
- Add npm packages unless needed for the tool
- Hardcode GitHub usernames in tool code

## Deploy

Push to `main`. GitHub Actions builds and publishes Pages.
Local check: `npm run build && npm run preview`
