import { describe, expect, it } from "vitest";
import { ACTIONS } from "./actions";
import { applySpend, blockReason, toSpendTarget, type SpendFields } from "./spend";

const ready: SpendFields = {
  moxie: 5,
  tempHp: 0,
  digDeep: true,
  digDeepActive: false,
  bloodiedUnbowed: true,
  swagger: true,
  guardedMind: true,
  downButNotOut: true,
  exhaustion: 0,
};

const open = { cantAct: false, bloodied: false };

function action(id: string) {
  const found = ACTIONS.find((item) => item.id === id);
  if (!found) throw new Error(id);
  return toSpendTarget(found);
}

describe("using a move from the list", () => {
  it("lets Dig Deep turn on once, then only come back by Exhaustion", () => {
    expect(blockReason(action("dig-deep"), ready, open)).toBeNull();
    const on = applySpend(ready, { apply: "dig-deep", cost: 0 }, open);
    expect(on.digDeep).toBe(false);
    expect(on.digDeepActive).toBe(true);
    expect(blockReason(action("dig-deep"), on, open)).toBe("Already used.");
    expect(blockReason(action("dig-deep-again"), on, open)).toBeNull();
    const again = applySpend(on, { apply: "dig-deep-exhaustion", cost: 0 }, open);
    expect(again.digDeep).toBe(true);
    expect(again.exhaustion).toBe(1);
    expect(again.digDeepActive).toBe(true);
  });

  it("refuses Dig Deep again at Exhaustion 5", () => {
    const spent = { ...ready, digDeep: false, exhaustion: 5 };
    expect(blockReason(action("dig-deep-again"), spent, open)).toBe(
      "That would be Exhaustion 6.",
    );
    expect(
      applySpend(spent, { apply: "dig-deep-exhaustion", cost: 0 }, open).exhaustion,
    ).toBe(5);
  });

  it("spends Moxie only when the pool can cover it", () => {
    expect(blockReason(action("one-two"), { ...ready, moxie: 0 }, open)).toBe(
      "Need 1 Moxie.",
    );
    const next = applySpend(ready, { apply: "moxie", cost: 1 }, open);
    expect(next.moxie).toBe(4);
  });

  it("keeps Brace Up's temporary hit points when the new roll is lower", () => {
    const next = applySpend(
      { ...ready, tempHp: 20 },
      { apply: "moxie", cost: 1, auto: "brace" },
      { ...open, braceTemp: 14 },
    );
    expect(next.tempHp).toBe(20);
    expect(next.moxie).toBe(4);
  });

  it("refills Moxie on Bloodied, and adds 36 temp HP only while bloodied", () => {
    const hurt = applySpend(
      { ...ready, moxie: 1, tempHp: 4 },
      { apply: "bloodied-unbowed", cost: 0 },
      { bloodied: true },
    );
    expect(hurt.moxie).toBe(5);
    expect(hurt.tempHp).toBe(36);
    expect(hurt.bloodiedUnbowed).toBe(false);
    const fine = applySpend(
      { ...ready, moxie: 1, tempHp: 4 },
      { apply: "bloodied-unbowed", cost: 0 },
      open,
    );
    expect(fine.tempHp).toBe(4);
  });

  it("blocks Down But Not Out until Gary is bloodied", () => {
    expect(blockReason(action("down-but-not-out"), ready, open)).toBe(
      "Only while bloodied.",
    );
    expect(
      blockReason(action("down-but-not-out"), ready, { cantAct: false, bloodied: true }),
    ).toBe(null);
  });

  it("still allows a free save rider while Gary can't act, and blocks Moxie", () => {
    const stuck = { cantAct: true, bloodied: false };
    expect(blockReason(action("guarded-mind"), ready, stuck)).toBeNull();
    expect(blockReason(action("haymaker"), ready, stuck)).toBe(
      "Moxie options are off until you can act.",
    );
    expect(blockReason(action("attack"), ready, stuck)).toBe(
      "You can't use an action, bonus, or reaction right now.",
    );
  });

  it("leaves reminder moves alone", () => {
    expect(blockReason(action("dodge"), ready, open)).toBe(
      "Nothing on the sheet changes.",
    );
  });
});
