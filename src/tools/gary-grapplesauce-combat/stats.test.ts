import { describe, expect, it } from "vitest";
import { DEFAULT_INVENTORY } from "./inventoryData";
import { computeGary } from "./stats";

describe("computeGary", () => {
  it("matches the equipped sheet: belt, wraps, and towel", () => {
    const gary = computeGary(DEFAULT_INVENTORY.items);
    expect(gary.scores.str).toBe(21);
    expect(gary.conMod).toBe(3);
    expect(gary.hpMax).toBe(103);
    expect(gary.ac).toBe(18);
    expect(gary.attack).toBe(9);
    expect(gary.athletics).toBe(13);
    expect(gary.fisticuffsDie).toBe(10);
    expect(gary.fisticuffsBonus).toBe(5);
    expect(gary.bloodiedAt).toBe(51);
  });

  it("drops back to Strength 8 and a lower AC with nothing equipped", () => {
    const bare = computeGary(
      DEFAULT_INVENTORY.items.map((item) => ({
        ...item,
        equipped: false,
        attuned: false,
      })),
    );
    expect(bare.scores.str).toBe(8);
    expect(bare.ac).toBe(15);
    expect(bare.attack).toBe(3);
  });
});
