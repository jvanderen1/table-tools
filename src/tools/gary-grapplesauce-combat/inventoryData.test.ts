import { describe, expect, it } from "vitest";
import {
  DEFAULT_INVENTORY,
  describeInventory,
  effectLabel,
  itemActive,
  magicItem,
  normalizeInventory,
  type InventoryItem,
} from "./inventoryData";

function item(
  partial: Partial<InventoryItem> & Pick<InventoryItem, "id">,
): InventoryItem {
  return {
    name: partial.id,
    aka: "",
    qty: 1,
    note: "",
    attuned: false,
    equipped: true,
    needsAttunement: false,
    effects: [],
    ...partial,
  };
}

describe("gear effects", () => {
  it("recognizes the lifting belt and ignores an empty name", () => {
    expect(magicItem("Belt of Hill Giant Strength")?.effects).toEqual([
      { target: "set:str", value: 21 },
    ]);
    expect(magicItem("  ")).toBeUndefined();
  });

  it("only counts an effect while the item is worn, in quantity, and attuned", () => {
    const belt = DEFAULT_INVENTORY.items[0];
    if (!belt) throw new Error("missing belt");
    expect(itemActive(belt)).toBe(true);
    expect(itemActive({ ...belt, equipped: false })).toBe(false);
    expect(itemActive({ ...belt, qty: 0 })).toBe(false);
    expect(itemActive({ ...belt, attuned: false })).toBe(false);
    expect(itemActive(item({ id: "rock" }))).toBe(false);
  });

  it("fills effects onto an old save that predates them", () => {
    const normalized = normalizeInventory({
      coins: { pp: 0, gp: 12, ep: 0, sp: 0, cp: 0 },
      items: [
        {
          id: "lifting-belt",
          name: "Lifting Belt",
          aka: "Belt of Hill Giant Strength",
          qty: 1,
          note: "",
          attuned: true,
        } as InventoryItem,
      ],
    });
    expect(normalized.coins.gp).toBe(12);
    expect(normalized.items[0]?.effects).toEqual([{ target: "set:str", value: 21 }]);
    expect(normalized.items[0]?.needsAttunement).toBe(true);
  });

  it("describes the change a player would undo", () => {
    const before = DEFAULT_INVENTORY;
    const belt = before.items[0];
    if (!belt) throw new Error("missing belt");
    const after = {
      ...before,
      items: before.items.map((entry) =>
        entry.id === belt.id ? { ...entry, equipped: false } : entry,
      ),
    };
    expect(describeInventory(before, after)?.label).toBe("Lifting Belt unequipped");
    expect(effectLabel({ target: "ac", value: 2 })).toBe("AC +2");
  });
});
