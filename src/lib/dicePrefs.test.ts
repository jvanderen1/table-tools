import { describe, expect, it } from "vitest";
import { isDiceHold } from "./dicePrefs";

describe("isDiceHold", () => {
  it("accepts the stay choices and nothing else", () => {
    expect(isDiceHold(5)).toBe(true);
    expect(isDiceHold("stay")).toBe(true);
    expect(isDiceHold(4)).toBe(false);
    expect(isDiceHold("5")).toBe(false);
  });
});
