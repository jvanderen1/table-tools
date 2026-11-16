import { describe, expect, it } from "vitest";
import { clampHoldSeconds, parseDiceHold } from "./dicePrefs";

describe("dice hold", () => {
  it("keeps a typed duration and never goes under 3 seconds", () => {
    expect(clampHoldSeconds(4)).toBe(4);
    expect(clampHoldSeconds(12.2)).toBe(12);
    expect(clampHoldSeconds(1)).toBe(3);
    expect(clampHoldSeconds(Number.NaN)).toBe(5);
  });

  it("reads the current value and the older saved forms", () => {
    expect(parseDiceHold({ seconds: 9, stay: false })).toEqual({ seconds: 9, stay: false });
    expect(parseDiceHold({ seconds: 1, stay: true })).toEqual({ seconds: 3, stay: true });
    expect(parseDiceHold(8)).toEqual({ seconds: 8, stay: false });
    expect(parseDiceHold("stay")).toEqual({ seconds: 5, stay: true });
    expect(parseDiceHold("5")).toBeNull();
  });
});
