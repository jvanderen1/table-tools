import { describe, expect, it } from "vitest";
import { playDiceSound } from "./diceSound";

describe("playDiceSound", () => {
  it("does nothing where there is no browser audio", () => {
    expect(() => playDiceSound(2, "crit")).not.toThrow();
  });
});
