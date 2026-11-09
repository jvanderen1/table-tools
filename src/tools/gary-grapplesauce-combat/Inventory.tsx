import { useRef, useState, type FormEvent } from "react";
import {
  Backpack,
  Check,
  Coins,
  Dumbbell,
  Minus,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { cx } from "../../lib/cx";
import {
  ATTUNE_MAX,
  COINS,
  EFFECT_TARGETS,
  MAGIC_ITEMS,
  QTY_MAX,
  effectLabel,
  itemActive,
  magicItem,
  type EffectTarget,
  type Inventory,
  type InventoryItem,
  type ItemEffect,
} from "./inventoryData";
import { ABILITIES } from "./conditions";
import { BARE_GARY, diceText, useGary, type GaryStats, type StatKey } from "./stats";
import { Button, Card, CardBody, CardHeader, Pill, Stack, Text } from "../../ui";

const FIELD =
  "w-full appearance-none rounded-lg border border-line bg-well px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-faint focus:border-gold/70";
const STEP =
  "grid size-7 shrink-0 cursor-pointer place-items-center rounded-md border border-line bg-well/70 text-ink hover:border-gold/50 disabled:cursor-not-allowed disabled:opacity-40";
const LABEL = "text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-faint";
const CHECK_ROW =
  "flex min-h-10 items-center gap-2 rounded-lg border border-line bg-well/60 px-3 text-sm";

function itemId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clampInt(value: string, max: number) {
  const n = Number.parseInt(value.replace(/\D/g, "") || "0", 10);
  return Math.min(max, Math.max(0, n));
}

function signed(n: number) {
  return `${n >= 0 ? "+" : "−"}${Math.abs(n)}`;
}

type Tile = {
  /** Stats whose gear sources explain this tile */
  from: StatKey[];
  label: string;
  value: (g: GaryStats) => string;
  delta: (g: GaryStats) => number;
};

const SCORE_TILES: Tile[] = ABILITIES.map(({ id, label }) => ({
  from: [id],
  label,
  value: (g: GaryStats) => `${g.scores[id]} (${signed(g.mods[id])})`,
  delta: (g: GaryStats) => g.scores[id],
}));

const COMBAT_TILES: Tile[] = [
  { from: ["ac", "con"], label: "AC", value: (g) => `${g.ac}`, delta: (g) => g.ac },
  {
    from: ["attack", "str"],
    label: "To hit",
    value: (g) => signed(g.attack),
    delta: (g) => g.attack,
  },
  {
    from: ["damage", "str"],
    label: "Damage",
    value: (g) => diceText(g.fisticuffsDie, g.fisticuffsBonus),
    delta: (g) => g.fisticuffsBonus,
  },
  {
    from: ["saves", "str"],
    label: "Str save",
    value: (g) => signed(g.saves.str),
    delta: (g) => g.saves.str,
  },
  {
    from: ["checks", "str"],
    label: "Athletics",
    value: (g) => signed(g.athletics),
    delta: (g) => g.athletics,
  },
  {
    from: ["initiative", "checks"],
    label: "Init",
    value: (g) => signed(g.initiative),
    delta: (g) => g.initiative,
  },
  {
    from: ["speed"],
    label: "Speed",
    value: (g) => `${g.speed} ft`,
    delta: (g) => g.speed,
  },
  {
    from: ["hpMax", "con"],
    label: "Max HP",
    value: (g) => `${g.hpMax}`,
    delta: (g) => g.hpMax,
  },
];

function StatTile({ tile, gary }: { tile: Tile; gary: GaryStats }) {
  const delta = tile.delta(gary) - tile.delta(BARE_GARY);
  const from = tile.from.flatMap((k) => gary.sources[k] ?? []);
  const shown = tile.value(gary);
  return (
    <div
      title={from.length > 0 ? from.join("\n") : "No gear bonus"}
      className={cx(
        "flex h-[4.25rem] flex-col items-center justify-center rounded-lg border px-1 text-center",
        delta !== 0 ? "border-gold/40 bg-gold/[0.06]" : "border-line bg-well/60",
      )}
    >
      <span className="text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-faint">
        {tile.label}
      </span>
      <span
        key={shown}
        className="animate-pop-in text-[0.95rem] font-semibold tabular-nums text-ink"
      >
        {shown}
      </span>
      <span
        className={cx(
          "text-[0.65rem] tabular-nums",
          delta > 0 ? "text-verdant" : delta < 0 ? "text-crimson-soft" : "text-faint",
        )}
      >
        {delta === 0 ? "base" : `${signed(delta)} gear`}
      </span>
    </div>
  );
}

/** What Gary's numbers are with the current gear, and how much the gear adds. */
function GearStats() {
  const gary = useGary();
  return (
    <Card>
      <CardHeader icon={Dumbbell}>Gary’s numbers</CardHeader>
      <CardBody>
        <Stack gap={10}>
          <div className="grid grid-cols-3 gap-1.5">
            {SCORE_TILES.map((tile) => (
              <StatTile key={tile.label} tile={tile} gary={gary} />
            ))}
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {COMBAT_TILES.map((tile) => (
              <StatTile key={tile.label} tile={tile} gary={gary} />
            ))}
          </div>
          <Text tone="tertiary">
            Flip a switch on an item to wear it or take it off. Gold tiles are above
            Gary’s base (Str 8, Con 17, proficiency +4). Header, rolls, and plans all
            follow these.
          </Text>
        </Stack>
      </CardBody>
    </Card>
  );
}

function itemStatus(item: InventoryItem, canAttune: boolean) {
  if (item.effects.length === 0) return null;
  const effects = item.effects.map(effectLabel).join(" · ");
  if (itemActive(item)) return { active: true, text: effects };
  if (item.qty === 0) return { active: false, text: `None left · ${effects}` };
  if (!item.equipped) return { active: false, text: `Off · ${effects}` };
  return {
    active: false,
    text: canAttune
      ? `Not attuned · ${effects}`
      : `Not attuned (${ATTUNE_MAX}/${ATTUNE_MAX} used) · ${effects}`,
  };
}

export function InventoryPanel({
  inventory,
  setInventory,
}: {
  inventory: Inventory;
  setInventory: (next: Inventory | ((prev: Inventory) => Inventory)) => void;
}) {
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const { items, coins } = inventory;
  const attunedCount = items.filter((i) => i.attuned).length;

  function patchItem(id: string, patch: Partial<InventoryItem>) {
    setInventory((inv) => ({
      ...inv,
      items: inv.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    }));
  }

  function bumpQty(id: string, delta: number) {
    setInventory((inv) => ({
      ...inv,
      items: inv.items.map((i) =>
        i.id === id ? { ...i, qty: Math.min(QTY_MAX, Math.max(0, i.qty + delta)) } : i,
      ),
    }));
  }

  /** Equipping an attunement item also attunes it when a slot is free. */
  function toggleEquip(id: string) {
    setInventory((inv) => {
      const used = inv.items.filter((i) => i.attuned).length;
      return {
        ...inv,
        items: inv.items.map((i) => {
          if (i.id !== id) return i;
          const equipped = !i.equipped;
          const attuned =
            equipped && i.needsAttunement && !i.attuned && used < ATTUNE_MAX
              ? true
              : i.attuned;
          return { ...i, equipped, attuned };
        }),
      };
    });
  }

  function addItem(e: FormEvent) {
    e.preventDefault();
    const name = draft.trim();
    if (!name) return;
    const preset = magicItem(name);
    setInventory((inv) => {
      const used = inv.items.filter((i) => i.attuned).length;
      const needs = preset?.attune ?? false;
      return {
        ...inv,
        items: [
          {
            id: itemId(),
            name,
            aka: preset ? preset.name : "",
            qty: 1,
            note: "",
            attuned: needs && used < ATTUNE_MAX,
            equipped: true,
            needsAttunement: needs,
            effects: preset?.effects ?? [],
          },
          ...inv.items,
        ],
      };
    });
    setDraft("");
    listRef.current?.scrollTo({ top: 0 });
  }

  function removeItem(item: InventoryItem) {
    setEditing(null);
    setInventory((inv) => ({
      ...inv,
      items: inv.items.filter((i) => i.id !== item.id),
    }));
  }

  return (
    <Stack gap={14}>
      <GearStats />
      <Card>
        <CardHeader
          icon={Backpack}
          trailing={
            <Pill active={attunedCount > 0}>
              <Sparkles className="size-3" aria-hidden />
              Attuned {attunedCount}/{ATTUNE_MAX}
            </Pill>
          }
        >
          Inventory
        </CardHeader>
        <CardBody>
          <Stack gap={14}>
            <div className="flex flex-col gap-1.5">
              <span className={cx(LABEL, "inline-flex items-center gap-1")}>
                <Coins className="size-3 text-gold/70" aria-hidden />
                Coins
              </span>
              <div className="grid grid-cols-5 gap-1.5">
                {COINS.map((coin) => (
                  <label
                    key={coin}
                    className="flex flex-col items-center gap-0.5 rounded-lg border border-line bg-well/60 px-1 pt-1 pb-1.5"
                  >
                    <span className="text-[0.68rem] font-semibold uppercase text-faint">
                      {coin}
                    </span>
                    <input
                      className="w-full bg-transparent text-center text-base font-semibold tabular-nums text-ink outline-none"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      aria-label={`${coin} coins`}
                      value={coins[coin]}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) =>
                        setInventory((inv) => ({
                          ...inv,
                          coins: {
                            ...inv.coins,
                            [coin]: clampInt(e.target.value, 999_999),
                          },
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
            </div>

            <form className="flex gap-2" onSubmit={addItem}>
              <input
                className={FIELD}
                placeholder="Add an item…"
                aria-label="New item name"
                list="gary-magic-items"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <Button
                type="submit"
                variant="primary"
                icon={Plus}
                className="shrink-0"
                disabled={draft.trim() === ""}
              >
                Add
              </Button>
            </form>
            <datalist id="gary-magic-items">
              {MAGIC_ITEMS.map((m) => (
                <option key={m.name} value={m.name} />
              ))}
            </datalist>

            <ul
              ref={listRef}
              className="m-0 flex h-[26rem] list-none flex-col gap-1.5 overflow-y-auto overscroll-contain rounded-xl border border-line bg-well/30 p-1.5"
              aria-label={`${items.length} items`}
            >
              {items.length === 0 ? (
                <li className="grid h-full place-items-center text-sm text-faint">
                  Nothing carried. Add an item above.
                </li>
              ) : null}
              {items.map((item) => {
                const canAttune = item.attuned || attunedCount < ATTUNE_MAX;
                if (editing === item.id) {
                  return (
                    <ItemEditor
                      key={item.id}
                      item={item}
                      canAttune={canAttune}
                      onChange={(patch) => patchItem(item.id, patch)}
                      onRemove={() => removeItem(item)}
                      onDone={() => setEditing(null)}
                    />
                  );
                }
                const status = itemStatus(item, canAttune);
                const active = status?.active ?? false;
                return (
                  <li
                    key={item.id}
                    className={cx(
                      "flex min-h-14 shrink-0 animate-pop-in items-center gap-2 rounded-lg border bg-surface/80 px-2 py-1.5",
                      active ? "border-gold/50" : "border-line",
                      item.qty === 0 && "opacity-50",
                    )}
                  >
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        className={STEP}
                        aria-label={`One fewer ${item.name}`}
                        disabled={item.qty <= 0}
                        onClick={() => bumpQty(item.id, -1)}
                      >
                        <Minus className="size-3.5" aria-hidden />
                      </button>
                      <span className="w-[3ch] text-center text-sm font-semibold tabular-nums">
                        {item.qty}
                      </span>
                      <button
                        type="button"
                        className={STEP}
                        aria-label={`One more ${item.name}`}
                        disabled={item.qty >= QTY_MAX}
                        onClick={() => bumpQty(item.id, 1)}
                      >
                        <Plus className="size-3.5" aria-hidden />
                      </button>
                    </div>
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-md px-1 py-0.5 text-left hover:bg-raised/50"
                      onClick={() => setEditing(item.id)}
                    >
                      <span className="flex min-w-0 flex-1 flex-col items-start">
                        <span className="flex w-full min-w-0 items-center gap-1.5">
                          <span className="truncate text-[0.92rem] font-medium text-ink">
                            {item.name}
                          </span>
                          {item.attuned ? (
                            <Sparkles
                              className="size-3.5 shrink-0 text-gold"
                              aria-label="Attuned"
                            />
                          ) : null}
                        </span>
                        <span
                          className={cx(
                            "w-full truncate text-xs",
                            status
                              ? active
                                ? "text-gold-soft"
                                : "text-faint"
                              : "text-faint",
                          )}
                        >
                          {status
                            ? status.text
                            : [item.aka, item.note].filter(Boolean).join(" · ") ||
                              "Tap to add details"}
                        </span>
                      </span>
                      <Pencil className="size-3.5 shrink-0 text-faint" aria-hidden />
                    </button>
                    {item.effects.length > 0 ? (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={item.equipped}
                        aria-label={`Equip ${item.name}`}
                        title={item.equipped ? "Equipped" : "Not equipped"}
                        className="flex h-10 w-11 shrink-0 cursor-pointer items-center justify-center"
                        onClick={() => toggleEquip(item.id)}
                      >
                        <span
                          className={cx(
                            "relative h-6 w-10 rounded-full border transition-colors",
                            item.equipped
                              ? "border-gold bg-gold/80"
                              : "border-line bg-well",
                          )}
                        >
                          <span
                            className={cx(
                              "absolute top-0.5 left-0.5 size-[1.125rem] rounded-full shadow transition-transform",
                              item.equipped
                                ? "translate-x-4 bg-void"
                                : "translate-x-0 bg-faint",
                            )}
                          />
                        </span>
                      </button>
                    ) : (
                      <span className="w-11 shrink-0" aria-hidden />
                    )}
                  </li>
                );
              })}
            </ul>

            <Text tone="tertiary">
              Flip the switch to equip or take off an item; equipped items with effects
              change Gary’s numbers everywhere (attunement items also need to be attuned).
              Tap an item to edit its effects, notes, or attunement. Mistake? Undo (bottom
              left).
            </Text>
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  );
}

function ItemEditor({
  item,
  canAttune,
  onChange,
  onRemove,
  onDone,
}: {
  item: InventoryItem;
  canAttune: boolean;
  onChange: (patch: Partial<InventoryItem>) => void;
  onRemove: () => void;
  onDone: () => void;
}) {
  function setAka(aka: string) {
    const preset = magicItem(aka);
    if (preset) {
      onChange({
        aka,
        effects: preset.effects,
        needsAttunement: preset.attune,
      });
    } else {
      onChange({ aka });
    }
  }

  function setEffect(index: number, patch: Partial<ItemEffect>) {
    onChange({
      effects: item.effects.map((e, i) => (i === index ? { ...e, ...patch } : e)),
    });
  }

  function changeTarget(index: number, target: EffectTarget) {
    const spec = EFFECT_TARGETS.find((t) => t.id === target);
    setEffect(index, { target, value: spec?.fallback ?? 1 });
  }

  return (
    <li className="flex shrink-0 flex-col gap-2 rounded-lg border border-gold/50 bg-surface p-2.5">
      <label className="flex flex-col gap-1">
        <span className={LABEL}>Name</span>
        <input
          className={FIELD}
          value={item.name}
          autoFocus
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className={LABEL}>Real item (optional)</span>
        <input
          className={FIELD}
          placeholder="e.g. Ring of Protection"
          list="gary-magic-items"
          value={item.aka}
          onChange={(e) => setAka(e.target.value)}
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className={LABEL}>Effects while equipped</span>
        {item.effects.length === 0 ? (
          <span className="text-xs text-faint">
            None. Pick a known magic item above, or add one.
          </span>
        ) : null}
        {item.effects.map((effect, index) => {
          const spec = EFFECT_TARGETS.find((t) => t.id === effect.target);
          return (
            <div
              key={index}
              className="flex flex-col gap-1.5 rounded-lg border border-line bg-well/50 p-2"
            >
              <div className="flex items-start gap-2">
                <span className="min-w-0 flex-1 text-sm leading-snug text-gold-soft">
                  {effectLabel(effect)}
                </span>
                <button
                  type="button"
                  className={cx(STEP, "size-9")}
                  aria-label={`Remove ${effectLabel(effect)}`}
                  onClick={() =>
                    onChange({ effects: item.effects.filter((_, i) => i !== index) })
                  }
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
              <select
                className={cx(FIELD, "py-1.5")}
                aria-label="Effect"
                value={effect.target}
                onChange={(e) => changeTarget(index, e.target.value as EffectTarget)}
              >
                {EFFECT_TARGETS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2">
                <span className={cx(LABEL, "w-14 shrink-0")}>Amount</span>
                <input
                  className={cx(FIELD, "w-24 py-1.5 text-center tabular-nums")}
                  aria-label="Amount"
                  inputMode="numeric"
                  value={effect.value}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const n = Number.parseInt(e.target.value.replace(/[^\d-]/g, ""), 10);
                    if (Number.isNaN(n)) return;
                    setEffect(index, {
                      value: Math.min(spec?.max ?? 30, Math.max(spec?.min ?? -30, n)),
                    });
                  }}
                />
              </label>
            </div>
          );
        })}
        <Button
          size="sm"
          variant="secondary"
          icon={Plus}
          onClick={() =>
            onChange({ effects: [...item.effects, { target: "ac", value: 1 }] })
          }
        >
          Add effect
        </Button>
      </div>

      <label className="flex flex-col gap-1">
        <span className={LABEL}>Notes</span>
        <textarea
          className={cx(FIELD, "min-h-16 resize-none")}
          placeholder="What it does, charges, where it is…"
          value={item.note}
          onChange={(e) => onChange({ note: e.target.value })}
        />
      </label>
      <label className={cx(CHECK_ROW, "cursor-pointer")}>
        <input
          type="checkbox"
          className="size-4 accent-gold"
          checked={item.needsAttunement}
          onChange={(e) => onChange({ needsAttunement: e.target.checked })}
        />
        <span className="flex-1">Requires attunement</span>
      </label>
      <label
        className={cx(
          CHECK_ROW,
          canAttune ? "cursor-pointer" : "cursor-not-allowed opacity-50",
        )}
      >
        <input
          type="checkbox"
          className="size-4 accent-gold"
          checked={item.attuned}
          disabled={!canAttune}
          onChange={(e) => onChange({ attuned: e.target.checked })}
        />
        <Sparkles className="size-4 text-gold/80" aria-hidden />
        <span className="flex-1">Attuned</span>
        <span className="text-xs text-faint">
          {canAttune ? `max ${ATTUNE_MAX}` : `${ATTUNE_MAX}/${ATTUNE_MAX} used`}
        </span>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="danger" size="sm" icon={Trash2} onClick={onRemove}>
          Remove
        </Button>
        <Button
          variant="primary"
          size="sm"
          icon={Check}
          disabled={item.name.trim() === ""}
          onClick={onDone}
        >
          Done
        </Button>
      </div>
    </li>
  );
}
