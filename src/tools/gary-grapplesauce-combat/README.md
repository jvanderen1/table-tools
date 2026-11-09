# Gary Grapplesauce — combat tool

Phone-friendly play aid for **Gary Grapplesauce** at the table. Live on GitHub Pages under `/#/tools/gary-grapplesauce-combat`.

## Who is Gary?

- **Player:** ClericOfWisdom (this tool’s owner)
- **Campaign:** Anthology — Tomb of Annihilation (DM Devaio)
- **Sheet:** [D&D Beyond 173364108](https://www.dndbeyond.com/characters/173364108) — **use the live sheet**, not PDF exports (items often don’t print)
- **Class:** Pugilist 9 · Squared Circle (Sterling Vermin / Partnered Content)
- **Species / background:** Human · Farmer
- **Feats:** Tavern Brawler (origin), Grappler, Mage Slayer, Tough
- **Vibe:** Bald gym-bro farmer, soft-looking, empty kind stare. Gym lexicon (Cardio, spot, hug). Soft comedy, not mean.

### Live numbers (magic items on)

| | |
|---|---|
| Str / Dex / Con / Int / Wis / Cha | **21** / 16 / 17 / 10 / 14 / 12 |
| HP | **103** |
| AC | **18** (Iron Chin 15 + Wrist Wraps +2 + Towel +1) |
| Unarmed | **+9 / 1d10+5** (Fisticuffs d10) |
| Athletics | **+13** (expertise) |
| Saves | Str **+10**, Con **+8**, others include Cloak +1 |
| Moxie | **5** (short rest) |

### Attuned items (3/3)

| Item | Rename | Effect |
|---|---|---|
| Belt of Hill Giant Strength | Lifting Belt | Str → 21 |
| Bracers of Defense | Wrist Wraps | +2 AC (no armor/shield) |
| Cloak of Protection | The Towel | +1 AC and saves |

Inventory flavor (no attunement): Pull-up Bar (Immovable Rod), Brass Knuckles, Water Bottle.

Point-buy joke: **Str 8 without the belt.**

## UI layout (keep this shape)

Three tabs so the screen isn’t a wall of controls:

| Tab | Job |
|---|---|
| **Play** | Combat decision tree (timing → goal/reaction → Action / BA / Reaction) |
| **Hit** | Take damage / heal (amount + type; Dig Deep auto-resists B/P/S) |
| **Conds** | 5e conditions + Exhaustion 0–6 (active ones show on the status bar) |
| **Rest** | Once-per-rest toggles + Short / Long rest |

Always visible above tabs: **HP bar**, **Moxie dots**, status pills (Bloodied, Dig Deep, conditions, ready uses).

Advanced damage options (override resistance, custom ± steps, temp HP) stay under **More damage options**.

### Persistence

Everything important is in `localStorage` under `table-tools:gary-grapplesauce-combat:*` (sheet, damage UI prefs, active tab). Same browser/phone keeps the last session.

### Decision tree behavior

- Filters goals/reactions by **Moxie** and limited uses (e.g. Bloodied But Unbowed needs bloodied HP ≤ 51 **and** the use free).
- **Apply** buttons spend Moxie / mark Dig Deep / Swagger / Bloodied refill.
- Live plans recompute when Moxie changes (e.g. Damage focus ↔ free Fisticuffs).

### Hit tab behavior

- Keyboard amount field (Enter = take damage; ↑/↓ = ±1).
- Damage types: all 13 5e types.
- **Auto** effectiveness: if Dig Deep is active and type is B/P/S → resistant (½).
- Manual override: normal / resistant / immune / vulnerable.
- Temp HP absorbs before real HP; alerts explain immune / resist / vuln / bloodied.

## Limited uses (track in Rest)

| Feature | Cadence | Notes |
|---|---|---|
| Moxie | Short rest | Pool of 5 |
| Bloodied But Unbowed | 1 / short rest | Reaction while bloodied + took damage → refill Moxie + 36 temp HP |
| Swagger Streak | 1 / short rest | Add 1d10 to a failed Str/Dex/Con/Cha check |
| Dig Deep | 1 / long rest | BA → resist B/P/S ~10 min; toggle “active” while up |

Short rest: Moxie full, Bloodied + Swagger ready, clear Dig Deep active + temp HP (conditions stay).  
Long rest: full HP/uses reset, clear conditions, Exhaustion −1 (2024-style).

## Table voice (optional)

When unsure: punch, then offer a spot. Signature lines live on the DDB notes (“Cardio.”, “HEY.”, “Sit Down.”).

## Editing this tool

- Code: `Tool.tsx` (UI + logic), `meta.ts` (home card)
- Shared chrome: `src/ui`, persistence: `src/lib/usePersistentState.ts`
- Register only via `src/tools/registry.ts` (already registered)
- After changes in this repo: describe with `jj`, move `main` to `@`, `jj git push --bookmark main` (auto-push preferred)

Do not rely on Cursor `.canvas.tsx` copies — this React tool is the source of truth for the hosted UI.
