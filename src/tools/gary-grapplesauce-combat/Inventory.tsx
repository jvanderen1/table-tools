import { useRef, useState, type FormEvent } from "react";
import {
  Backpack,
  Check,
  Coins,
  Minus,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { cx } from "../../lib/cx";
import {
  ATTUNE_MAX,
  COINS,
  QTY_MAX,
  type Inventory,
  type InventoryItem,
} from "./inventoryData";
import { Button, Card, CardBody, CardHeader, Pill, Stack, Text } from "../../ui";

const FIELD =
  "w-full appearance-none rounded-lg border border-line bg-well px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-faint focus:border-gold/70";
const STEP =
  "grid size-7 shrink-0 cursor-pointer place-items-center rounded-md border border-line bg-well/70 text-ink hover:border-gold/50 disabled:cursor-not-allowed disabled:opacity-40";
const LABEL =
  "text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-faint";

function itemId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clampInt(value: string, max: number) {
  const n = Number.parseInt(value.replace(/\D/g, "") || "0", 10);
  return Math.min(max, Math.max(0, n));
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
        i.id === id
          ? { ...i, qty: Math.min(QTY_MAX, Math.max(0, i.qty + delta)) }
          : i,
      ),
    }));
  }

  function addItem(e: FormEvent) {
    e.preventDefault();
    const name = draft.trim();
    if (!name) return;
    setInventory((inv) => ({
      ...inv,
      items: [
        { id: itemId(), name, aka: "", qty: 1, note: "", attuned: false },
        ...inv.items,
      ],
    }));
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
            {items.map((item) =>
              editing === item.id ? (
                <ItemEditor
                  key={item.id}
                  item={item}
                  canAttune={item.attuned || attunedCount < ATTUNE_MAX}
                  onChange={(patch) => patchItem(item.id, patch)}
                  onRemove={() => removeItem(item)}
                  onDone={() => setEditing(null)}
                />
              ) : (
                <li
                  key={item.id}
                  className={cx(
                    "flex min-h-14 shrink-0 animate-pop-in items-center gap-2 rounded-lg border bg-surface/80 px-2 py-1.5",
                    item.attuned ? "border-gold/40" : "border-line",
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
                    className="flex min-w-0 flex-1 cursor-pointer flex-col items-start rounded-md px-1 py-0.5 text-left hover:bg-raised/50"
                    onClick={() => setEditing(item.id)}
                  >
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
                    <span className="w-full truncate text-xs text-faint">
                      {[item.aka, item.note].filter(Boolean).join(" · ") ||
                        "Tap to add details"}
                    </span>
                  </button>
                  <Pencil
                    className="size-3.5 shrink-0 text-faint"
                    aria-hidden
                  />
                </li>
              ),
            )}
          </ul>

          <Text tone="tertiary">
            Tap an item to rename it, add notes, or set attunement. Removed
            something by mistake? Undo (bottom left). This list doesn’t change
            Gary’s numbers; those stay as on the live sheet.
          </Text>
        </Stack>
      </CardBody>
    </Card>
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
          placeholder="e.g. Immovable Rod"
          value={item.aka}
          onChange={(e) => onChange({ aka: e.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className={LABEL}>Notes</span>
        <textarea
          className={cx(FIELD, "min-h-16 resize-none")}
          placeholder="What it does, charges, where it is…"
          value={item.note}
          onChange={(e) => onChange({ note: e.target.value })}
        />
      </label>
      <label
        className={cx(
          "flex min-h-10 items-center gap-2 rounded-lg border border-line bg-well/60 px-3 text-sm",
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
