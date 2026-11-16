import { describe, expect, it } from "vitest";
import { actionChips, usageChip, type UsageSheet } from "./cost";

const ready: UsageSheet = {
  moxie: 5,
  digDeep: true,
  digDeepActive: false,
  bloodiedUnbowed: true,
  swagger: true,
  guardedMind: true,
  downButNotOut: true,
};

describe("limited uses", () => {
  it("counts Dig Deep as one long-rest use, including the exhaustion restore", () => {
    expect(
      usageChip({ id: "dig-deep", part: "bonus", moxie: 0, apply: "dig-deep" }, ready),
    ).toEqual({
      label: "1/1 long",
      tone: "ready",
    });
    expect(
      usageChip(
        { id: "dig-deep", part: "bonus", moxie: 0, apply: "dig-deep" },
        { ...ready, digDeep: false, digDeepActive: true },
      ),
    ).toEqual({ label: "On", tone: "on" });
    expect(
      usageChip(
        { id: "dig-deep-again", part: "free", moxie: 0, apply: "dig-deep-exhaustion" },
        { ...ready, digDeep: false },
      )?.label,
    ).toBe("0/1 long");
    expect(
      usageChip(
        { id: "dig-deep", part: "bonus", moxie: 0, apply: "dig-deep" },
        { ...ready, digDeep: true, digDeepActive: true },
      )?.label,
    ).toBe("On · 1 left");
  });

  it("uses a short rest for Bloodied, Swagger, and Guarded Mind, and a long rest for Down But Not Out", () => {
    expect(
      usageChip(
        { id: "bloodied", part: "reaction", moxie: 0, apply: "bloodied-unbowed" },
        ready,
      )?.label,
    ).toBe("1/1 short");
    expect(
      usageChip(
        { id: "swagger", part: "free", moxie: 1, apply: "swagger" },
        { ...ready, swagger: false },
      )?.label,
    ).toBe("0/1 short");
    expect(
      usageChip(
        { id: "guarded-mind", part: "free", moxie: 0, apply: "guarded-mind" },
        ready,
      )?.label,
    ).toBe("1/1 short");
    expect(
      usageChip(
        { id: "down-but-not-out", part: "free", moxie: 0, apply: "down-but-not-out" },
        { ...ready, downButNotOut: false },
      )?.label,
    ).toBe("0/1 long");
  });

  it("shows Moxie left against the cost", () => {
    const chips = actionChips(
      { id: "one-two", part: "bonus", moxie: 1, apply: "moxie" },
      { ...ready, moxie: 0 },
    );
    expect(chips.map((chip) => chip.label)).toEqual(["1 Bonus", "1 Moxie", "0/5"]);
    expect(chips.at(-1)?.tone).toBe("spent");
  });
});
