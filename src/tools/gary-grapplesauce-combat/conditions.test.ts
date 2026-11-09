import { describe, expect, it } from "vitest";
import {
  CONDITION_DEFS,
  computeConditionEffects,
  type ConditionFlags,
  type ConditionId,
} from "./conditions";

function flags(active: ConditionId[] = []): ConditionFlags {
  return Object.fromEntries(
    CONDITION_DEFS.map((condition) => [condition.id, active.includes(condition.id)]),
  ) as ConditionFlags;
}

describe("computeConditionEffects", () => {
  it("leaves a healthy Gary at full speed with no penalty", () => {
    const effects = computeConditionEffects(flags(), 0, 30);
    expect(effects.dead).toBe(false);
    expect(effects.d20Penalty).toBe(0);
    expect(effects.speed.value).toBe(30);
    expect(effects.cantAct).toHaveLength(0);
  });

  it("kills Gary at exhaustion 6 and slows him before that", () => {
    const tired = computeConditionEffects(flags(), 2, 30);
    expect(tired.dead).toBe(false);
    expect(tired.d20Penalty).toBe(4);
    expect(tired.speed.value).toBe(20);

    const dead = computeConditionEffects(flags(), 6, 30);
    expect(dead.dead).toBe(true);
    expect(dead.speed.value).toBe(0);
  });

  it("treats unconscious as unable to act, prone, and speed 0", () => {
    const effects = computeConditionEffects(flags(["unconscious"]), 0, 30);
    expect(effects.cantAct.map((reason) => reason.label)).toContain("Unconscious");
    expect(effects.speed.value).toBe(0);
    expect(effects.attack.roll).toBe("disadvantage");
  });

  it("resists all damage while petrified", () => {
    const effects = computeConditionEffects(flags(["petrified"]), 0, 30);
    expect(effects.resistAll.map((reason) => reason.label)).toContain("Petrified");
  });
});
