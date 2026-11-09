import type { Change } from "../../lib/useUndoableState";
import { ABILITIES, type Ability } from "./conditions";

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
  /** Worn or in hand. Effects only count while equipped (and attuned, if needed). */
  equipped: boolean;
  needsAttunement: boolean;
  effects: ItemEffect[];
};

/** "set:str" = Str becomes N (no effect if already higher); "add:str" = Str +N. */
export type EffectTarget =
  | "ac"
  | "saves"
  | "checks"
  | "attack"
  | "damage"
  | "speed"
  | "initiative"
  | `set:${Ability}`
  | `add:${Ability}`;

export type ItemEffect = { target: EffectTarget; value: number };

export const EFFECT_TARGETS: {
  id: EffectTarget;
  label: string;
  min: number;
  max: number;
  fallback: number;
}[] = [
  { id: "ac", label: "AC", min: -5, max: 10, fallback: 1 },
  { id: "saves", label: "All saves", min: -5, max: 10, fallback: 1 },
  { id: "checks", label: "All ability checks", min: -5, max: 10, fallback: 1 },
  { id: "attack", label: "Unarmed attack", min: -5, max: 10, fallback: 1 },
  { id: "damage", label: "Unarmed damage", min: -5, max: 10, fallback: 1 },
  { id: "speed", label: "Speed (ft)", min: -30, max: 60, fallback: 10 },
  { id: "initiative", label: "Initiative", min: -5, max: 10, fallback: 1 },
  ...ABILITIES.map((a) => ({
    id: `set:${a.id}` as EffectTarget,
    label: `${a.label} becomes`,
    min: 1,
    max: 30,
    fallback: 19,
  })),
  ...ABILITIES.map((a) => ({
    id: `add:${a.id}` as EffectTarget,
    label: `${a.label} score`,
    min: -10,
    max: 10,
    fallback: 2,
  })),
];

export function effectLabel({ target, value }: ItemEffect) {
  const signed = `${value >= 0 ? "+" : "−"}${Math.abs(value)}`;
  if (target.startsWith("set:")) {
    const ability = ABILITIES.find((a) => a.id === target.slice(4));
    return `${ability?.label ?? target} ${value}`;
  }
  if (target.startsWith("add:")) {
    const ability = ABILITIES.find((a) => a.id === target.slice(4));
    return `${ability?.label ?? target} ${signed}`;
  }
  switch (target) {
    case "ac":
      return `AC ${signed}`;
    case "saves":
      return `Saves ${signed}`;
    case "checks":
      return `Checks ${signed}`;
    case "attack":
      return `To hit ${signed}`;
    case "damage":
      return `Damage ${signed}`;
    case "speed":
      return `Speed ${signed} ft`;
    case "initiative":
      return `Init ${signed}`;
  }
  return target;
}

/** True when the item is changing Gary's numbers right now. */
export function itemActive(item: InventoryItem) {
  return (
    item.effects.length > 0 &&
    item.equipped &&
    item.qty > 0 &&
    (!item.needsAttunement || item.attuned)
  );
}

/** Common magic items: picking one as the "real item" fills in its effects. */
export const MAGIC_ITEMS: {
  name: string;
  attune: boolean;
  effects: ItemEffect[];
}[] = [
  { name: "Amulet of Health", attune: true, effects: [{ target: "set:con", value: 19 }] },
  {
    name: "Belt of Hill Giant Strength",
    attune: true,
    effects: [{ target: "set:str", value: 21 }],
  },
  {
    name: "Belt of Stone Giant Strength",
    attune: true,
    effects: [{ target: "set:str", value: 23 }],
  },
  {
    name: "Belt of Frost Giant Strength",
    attune: true,
    effects: [{ target: "set:str", value: 23 }],
  },
  {
    name: "Belt of Fire Giant Strength",
    attune: true,
    effects: [{ target: "set:str", value: 25 }],
  },
  {
    name: "Belt of Cloud Giant Strength",
    attune: true,
    effects: [{ target: "set:str", value: 27 }],
  },
  {
    name: "Belt of Storm Giant Strength",
    attune: true,
    effects: [{ target: "set:str", value: 29 }],
  },
  { name: "Bracers of Defense", attune: true, effects: [{ target: "ac", value: 2 }] },
  {
    name: "Cloak of Protection",
    attune: true,
    effects: [
      { target: "ac", value: 1 },
      { target: "saves", value: 1 },
    ],
  },
  {
    name: "Gauntlets of Ogre Power",
    attune: true,
    effects: [{ target: "set:str", value: 19 }],
  },
  {
    name: "Headband of Intellect",
    attune: true,
    effects: [{ target: "set:int", value: 19 }],
  },
  {
    name: "Ioun Stone of Agility",
    attune: true,
    effects: [{ target: "add:dex", value: 2 }],
  },
  {
    name: "Ioun Stone of Fortitude",
    attune: true,
    effects: [{ target: "add:con", value: 2 }],
  },
  {
    name: "Ioun Stone of Protection",
    attune: true,
    effects: [{ target: "ac", value: 1 }],
  },
  {
    name: "Ioun Stone of Strength",
    attune: true,
    effects: [{ target: "add:str", value: 2 }],
  },
  {
    name: "Ring of Protection",
    attune: true,
    effects: [
      { target: "ac", value: 1 },
      { target: "saves", value: 1 },
    ],
  },
  {
    name: "Stone of Good Luck",
    attune: true,
    effects: [
      { target: "checks", value: 1 },
      { target: "saves", value: 1 },
    ],
  },
];

export function magicItem(name: string) {
  const key = name.trim().toLowerCase();
  return key ? MAGIC_ITEMS.find((m) => m.name.toLowerCase() === key) : undefined;
}

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
      equipped: true,
      needsAttunement: true,
      effects: [{ target: "set:str", value: 21 }],
    },
    {
      id: "wrist-wraps",
      name: "Wrist Wraps",
      aka: "Bracers of Defense",
      qty: 1,
      note: "+2 AC with no armor or shield.",
      attuned: true,
      equipped: true,
      needsAttunement: true,
      effects: [{ target: "ac", value: 2 }],
    },
    {
      id: "the-towel",
      name: "The Towel",
      aka: "Cloak of Protection",
      qty: 1,
      note: "+1 AC and saving throws.",
      attuned: true,
      equipped: true,
      needsAttunement: true,
      effects: [
        { target: "ac", value: 1 },
        { target: "saves", value: 1 },
      ],
    },
    {
      id: "pull-up-bar",
      name: "Pull-up Bar",
      aka: "Immovable Rod",
      qty: 1,
      note: "Press the button to lock it in place.",
      attuned: false,
      equipped: true,
      needsAttunement: false,
      effects: [],
    },
    {
      id: "brass-knuckles",
      name: "Brass Knuckles",
      aka: "",
      qty: 1,
      note: "",
      attuned: false,
      equipped: true,
      needsAttunement: false,
      effects: [],
    },
    {
      id: "water-bottle",
      name: "Water Bottle",
      aka: "",
      qty: 1,
      note: "",
      attuned: false,
      equipped: true,
      needsAttunement: false,
      effects: [],
    },
  ],
  coins: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
};

const SEEDS = new Map(DEFAULT_INVENTORY.items.map((i) => [i.id, i]));

/** Fills fields added after an inventory was first saved. */
export function normalizeInventory(raw: Inventory): Inventory {
  return {
    coins: { ...DEFAULT_INVENTORY.coins, ...(raw?.coins ?? {}) },
    items: (raw?.items ?? []).map((i) => {
      const seed = SEEDS.get(i.id);
      const preset = magicItem(i.aka ?? "");
      return {
        ...i,
        equipped: i.equipped ?? true,
        needsAttunement:
          i.needsAttunement ?? seed?.needsAttunement ?? preset?.attune ?? !!i.attuned,
        effects: i.effects ?? seed?.effects ?? preset?.effects ?? [],
      };
    }),
  };
}

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
    if (!before.has(item.id))
      return { label: `Added ${item.name}`, key: `add:${item.id}` };
  }
  for (const item of prev.items) {
    if (!after.has(item.id))
      return { label: `Removed ${item.name}`, key: `remove:${item.id}` };
  }
  for (const item of next.items) {
    const old = before.get(item.id);
    if (!old) continue;
    if (old.qty !== item.qty) {
      return { label: `${item.name} ${old.qty} → ${item.qty}`, key: `qty:${item.id}` };
    }
    if (old.equipped !== item.equipped) {
      return {
        label: `${item.name} ${item.equipped ? "equipped" : "unequipped"}`,
        key: `equip:${item.id}`,
      };
    }
    if (old.attuned !== item.attuned) {
      return {
        label: `${item.name} ${item.attuned ? "attuned" : "unattuned"}`,
        key: `attune:${item.id}`,
      };
    }
    if (
      old.name !== item.name ||
      old.aka !== item.aka ||
      old.note !== item.note ||
      old.needsAttunement !== item.needsAttunement ||
      JSON.stringify(old.effects) !== JSON.stringify(item.effects)
    ) {
      return { label: `Edited ${old.name || item.name}`, key: `edit:${item.id}` };
    }
  }
  return null;
}
