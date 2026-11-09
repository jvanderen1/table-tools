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
| **Hit** | Take damage / heal (amount + type; Dig Deep auto-resists nonmagical B/P/S) |
| **Roll** | Saves, checks, unarmed attack, and hit dice — bonuses include conditions |
| **Conds** | Effects on Gary (auto-calculated) + 2024 conditions + Exhaustion 0–6 |
| **Rest** | Once-per-rest toggles + Short / Long rest |
| **Gear** | Inventory (`Inventory.tsx`): coins, items with quantity, nickname → real item, notes, attunement (max 3) |
| **Bio** | Personality & biography, plus optional AI “Say it like Gary” lines (`Persona.tsx`) |

### Bio tab behavior (`Persona.tsx`)

- **Personality & biography**: concept, personality, voice/catchphrases, ideals, bonds, flaws, backstory. Seeded from “Who is Gary?” above; ideals/bonds/flaws start blank for the player. Persisted under `bio` (in backups).
- **Say it like Gary**: optional situation text + six quick asks (battle cry, taunt, hype ally, reply, took a hit, victory) or a free “fits the situation” line. The prompt includes the whole bio plus live state (`personaStatus`: HP/bloodied, Moxie, temp HP, Dig Deep, Exhaustion, conditions). Last 20 lines persisted under `voice-log`.
- **AI is bring-your-own-key**, called straight from the browser (`src/lib/ai.ts`): Anthropic (default `claude-haiku-5-5`, uses the `anthropic-dangerous-direct-browser-access` header) or OpenAI (Responses API; model picked from the key’s model list). The key is stored under `table-tools-secret:ai`, outside the `table-tools:` prefix, so backups never include it. No server, no key in the repo.

### Gear tab behavior

- Seeded from the attuned items and inventory flavor above (the DDB sheet is private, so coins start at 0 — fill them in). Persisted under `inventory`.
- Add box on top; new items go to the top of a fixed-height list that scrolls on its own, so adding never moves the page.
- Tap an item to edit name, real item, notes, attunement, or remove it (no confirm; Undo brings it back). Quantity 0 keeps the item, dimmed.
- Purely a record: it doesn’t change the numbers in `GARY`. If an attuned item changes, update `GARY` too.

Always visible above tabs: **HP bar**, **Moxie dots**, and three status sections, all fixed-size so changes never move the page (no sideways carousels; everything is visible at a glance):

- **Ready** — three permanent tiles (Unbowed, Swagger, Dig Deep): green check = ready, dim + struck = used, gold = Dig Deep on. Tap for the rules.
- **Now** — Bloodied, Exhaustion, and conditions in a 3 × 2 slot grid. More than 6 → the last slot becomes “+N more” (opens Conds details).
- **Effects** — what those mean for Gary’s numbers, 2 × 2 slots, same “+N more” rule, plus **Details**.

Advanced damage options (override resistance, custom ± steps, temp HP) stay under **More damage options**.

### Persistence

Everything important is in `localStorage` under `table-tools:gary-grapplesauce-combat:*` (sheet, damage UI prefs, active tab). Same browser/phone keeps the last session.

### Undo / history

The sheet and the inventory use `useUndoableState` (`src/lib/useUndoableState.ts`), so every change (damage, rests, plan “Spend” buttons, Moxie taps, conditions, gear edits) lands on a timeline saved next to the value (`sheet-history`, `inventory-history`, last 40 steps each).

- Floating pill, bottom left: **Undo**, **Redo**, **History**. Always rendered; disabled when there’s nothing to do. A short toast says what was undone.
- **History** drawer merges both timelines by time, labelled in plain words (“HP 103 → 88”, “Added Torch”). **Go back** undoes that change and everything after it; undone steps stay listed with **Redo** until a new change replaces them.
- Quick repeat taps on the same thing merge into one step (sheet within 0.6 s, gear within 4 s, so typing a note is one step).
- ⌘Z / Ctrl+Z undo, ⇧⌘Z / Ctrl+Y redo (ignored while typing in a field).
- Undo/redo re-enables the plan’s apply button. Roll log, dice, tab, and Bio aren’t tracked.
- Labels come from `describeSheetChange` (Tool.tsx) and `describeInventory` (`inventoryData.ts`); add new sheet fields there.

### Decision tree behavior

- Filters goals/reactions by **Moxie** and limited uses (e.g. Bloodied But Unbowed needs bloodied HP ≤ 51 **and** the use free).
- **Apply** buttons spend Moxie / mark Dig Deep / Swagger / Bloodied refill.
- Live plans recompute when Moxie changes (e.g. Damage focus ↔ free Fisticuffs).

### Hit tab behavior

- Keyboard amount field (Enter = take damage; ↑/↓ = ±1).
- Damage types: all 13 5e types.
- **Auto** effectiveness: if Dig Deep is active and type is B/P/S → resistant (½).
- **Magical** toggle (B/P/S only, remembered like the type): magical hits skip Dig Deep. The Pugilist post just says “Resistance to B/P/S”; the owner chose the nonmagical reading for this table. Petrified still resists everything.
- Manual override: normal / resistant / immune / vulnerable.
- Temp HP absorbs before real HP; alerts explain immune / resist / vuln / bloodied.

### Conditions behavior

`conditions.ts` holds the 2024 condition text ([Rules Glossary](https://www.dndbeyond.com/sources/dnd/br-2024/rules-glossary)) and `computeConditionEffects`, which turns active conditions + Exhaustion into Gary’s numbers:

- Attack, Athletics, all six saves, Initiative: Exhaustion −2 × level; Advantage/Disadvantage sources listed (they cancel per the rules).
- Str/Dex auto-fail (Paralyzed, Petrified, Stunned, Unconscious); Dex save Disadvantage (Restrained).
- Attacks vs. Gary split by within / beyond 5 ft (Prone), auto-crit within 5 ft (Paralyzed, Unconscious).
- Speed: 30 − 5 × Exhaustion, 0 from Grappled/Restrained/Paralyzed/Petrified/Unconscious.
- Incapacitated family → no Action/BA/Reaction: Play tab warns, Bloodied But Unbowed is locked.
- Petrified → Hit tab auto-resists all damage.
- **Exhaustion 6 = death** (2024 rule). At 6 the decision tree hides, the header/status say dead, and Long rest is disabled. At 5 the Play tab warns “one level from death”.
- **Dig Deep again** (after the free use) costs 1 Exhaustion: offered in the Survive plan (no Moxie) and on the Rest tab, and refused when it would reach 6.

### Roll tab

Buttons use the same condition math as the effects card (Exhaustion −2 per level, Advantage / Disadvantage, auto-fail saves). Each button shows the bonus you’ll actually roll.

| Button | Bonus before Exhaustion |
|---|---|
| Saves | Str +10, Dex +4, Con +8, Int +1, Wis +3, Cha +2 (Towel included) |
| Ability checks | Str +5, Dex +3, Con +3, Int +0, Wis +2, Cha +1 |
| Skills | Athletics +13, Perception +6, Insight +6 |
| Initiative | +3 |
| Unarmed | +9 to hit (nat 20 crit, nat 1 miss), with Damage 1d10+5 beside it (2d10+5 after a crit) |

A **Dice** button floats in the bottom-right corner. Tap dice to build a mixed pool (up to 20 of each of d4, d6, d8, d10, d12, d20, and d100), set a modifier, and roll. The tray has a fixed height: the pool scrolls sideways and only the log scrolls, so nothing moves while you build or roll. **Hide** masks every total (the setting is remembered) and **Clear log** empties the history. It does not change HP.

**Every roll is logged in one place.** Roll tab saves/checks/attacks/damage/Swagger, the Play-plan dice (to-hit, damage, Brace Up, Swagger), and the tray all write to the shared log in `rollLog.ts` (React context provided by `GaryCombatTool`, persisted under `roll-log`, last 50). The tray's **Latest roll** box shows the newest roll from anywhere with how long ago it was. The **Roll log** under it lists every roll including that one (gold-outlined, tagged “Latest”), each with its time ago; hover or long-press a row for the exact time. Crits are gold, misses and auto-fails red.

**Crit toggle.** One shared flag (persisted under `crit`) shown as a **Crit** button next to every Damage button. A natural 20 on an attack turns it on, any other attack roll turns it off, and a damage roll uses it (2d10+5) and then turns it off. Tap it to set it by hand (e.g. hitting a Paralyzed target within 5 ft).

On a Play plan, to-hit, damage, Brace Up, and Swagger sit under the action they belong to.

Str/Dex/Con/Cha checks (including Athletics) offer **Add Swagger +1d10** while that use is ready. Blinded/Deafened don’t auto-fail every check — the tab says which ones need sight or hearing.

The status card shows short “Effects” chips; the header line shows adjusted attack/Athletics/speed. Base numbers live in `GARY` in `Tool.tsx` — update there if the sheet changes.

## Limited uses (track in Rest)

| Feature | Cadence | Notes |
|---|---|---|
| Moxie | Short rest | Pool of 5 |
| Bloodied But Unbowed | 1 / short rest | Reaction while bloodied + took damage → refill Moxie + 36 temp HP |
| Swagger Streak | 1 / short rest | Add 1d10 to a failed Str/Dex/Con/Cha check |
| Dig Deep | 1 free / long rest | BA → resist nonmagical B/P/S ~10 min; toggle “active” while up. Extra uses cost 1 Exhaustion each (never to 6) |

Short rest: Moxie full, Bloodied + Swagger ready, clear Dig Deep active + temp HP (conditions stay).  
Long rest: full HP/uses reset, clear conditions, Exhaustion −1 (2024-style).

## Table voice (optional)

When unsure: punch, then offer a spot. Signature lines live on the DDB notes (“Cardio.”, “HEY.”, “Sit Down.”).

## Tooltips / glossary

Tap any **ⓘ** next to a feature name (or open the **Rules glossary** drawer on the Play tab). Copy lives in `glossary.ts`, primarily from the official Sterling Vermin Pugilist 2024 D&D Beyond announcement:

https://www.dndbeyond.com/posts/2130-the-pugilist-class-comes-brawling-onto-d-d-beyond

Gary-specific math (e.g. Brace Up `1d10+12`, Bloodied temp HP 36) is annotated in those blurbs. If the live class text on DDB differs, prefer the character sheet and update `glossary.ts`.

## Editing this tool

- Code: `Tool.tsx` (UI + logic), `meta.ts` (home card), `glossary.ts` / `Tip.tsx` (rules tips)
- Shared chrome: `src/ui` (Card, Button, Stat, Accordion, Drawer…), persistence: `src/lib/usePersistentState.ts`
- Styling: Tailwind v4 utilities in markup; palette and fonts are `@theme` tokens in `src/styles.css` (`void` #0B0C10, `surface` #1F2833, `gold` #C5A059, `crimson`; Cinzel headings, Inter body). Icons are `lucide-react`.
- Long reference text (cheat sheet, Pugilist glossary, condition reference) lives in slide-out drawers, not inline
- Register only via `src/tools/registry.ts` (already registered)
- After changes in this repo: describe with `jj`, move `main` to `@`, `jj git push --bookmark main` (auto-push preferred)

Do not rely on Cursor `.canvas.tsx` copies — this React tool is the source of truth for the hosted UI.
