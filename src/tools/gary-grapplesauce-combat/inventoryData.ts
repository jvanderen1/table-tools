import type { Change } from "../../lib/useUndoableState";

export const ATTUNE_MAX = 3;
export const QTY_MAX = 999;
export const COINS = ["pp", "gp", "ep", "sp", "cp"] as const;

export type Coin = (typeof COINS)[number];

export type InventoryItem = {
  id: string;
  name: string;
  /** The rules item behind a table nickname, e.g. "Immovable Rod" */
  aka: string;
  qty: number;
  note: string;
  attuned: boolean;
};

export type Inventory = {
  items: InventoryItem[];
  coins: Record<Coin, number>;
};

export const DEFAULT_INVENTORY: Inventory = {
  items: [
    {
      id: "lifting-belt",
      name: "Lifting Belt",
      aka: "Belt of Hill Giant Strength",
      qty: 1,
      note: "Strength becomes 21.",
      attuned: true,
    },
    {
      id: "wrist-wraps",
      name: "Wrist Wraps",
      aka: "Bracers of Defense",
      qty: 1,
      note: "+2 AC with no armor or shield.",
      attuned: true,
    },
    {
      id: "the-towel",
      name: "The Towel",
      aka: "Cloak of Protection",
      qty: 1,
      note: "+1 AC and saving throws.",
      attuned: true,
    },
    {
      id: "pull-up-bar",
      name: "Pull-up Bar",
      aka: "Immovable Rod",
      qty: 1,
      note: "Press the button to lock it in place.",
      attuned: false,
    },
    {
      id: "brass-knuckles",
      name: "Brass Knuckles",
      aka: "",
      qty: 1,
      note: "",
      attuned: false,
    },
    {
      id: "water-bottle",
      name: "Water Bottle",
      aka: "",
      qty: 1,
      note: "",
      attuned: false,
    },
  ],
  coins: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
};

/** Plain-language summary of one inventory change, for the undo timeline. */
export function describeInventory(prev: Inventory, next: Inventory): Change {
  for (const coin of COINS) {
    if (prev.coins[coin] !== next.coins[coin]) {
      return {
        label: `${coin} ${prev.coins[coin]} → ${next.coins[coin]}`,
        key: `coin:${coin}`,
      };
    }
  }
  const before = new Map(prev.items.map((i) => [i.id, i]));
  const after = new Map(next.items.map((i) => [i.id, i]));
  for (const item of next.items) {
    if (!before.has(item.id)) return { label: `Added ${item.name}`, key: `add:${item.id}` };
  }
  for (const item of prev.items) {
    if (!after.has(item.id)) return { label: `Removed ${item.name}`, key: `remove:${item.id}` };
  }
  for (const item of next.items) {
    const old = before.get(item.id);
    if (!old) continue;
    if (old.qty !== item.qty) {
      return { label: `${item.name} ${old.qty} → ${item.qty}`, key: `qty:${item.id}` };
    }
    if (old.attuned !== item.attuned) {
      return {
        label: `${item.name} ${item.attuned ? "attuned" : "unattuned"}`,
        key: `attune:${item.id}`,
      };
    }
    if (old.name !== item.name || old.aka !== item.aka || old.note !== item.note) {
      return { label: `Edited ${old.name || item.name}`, key: `edit:${item.id}` };
    }
  }
  return null;
}
