import { describe, expect, it } from "vitest";
import { faceLabel, layoutThrow, solidReport, type SupportedSides } from "./diceGeometry";

const DICE: SupportedSides[] = [4, 6, 8, 10, 12, 20];

describe("dice solids", () => {
  it.each(DICE)("builds a d%s whose faces settle toward the camera", (sides) => {
    const report = solidReport(sides);
    expect(report.count).toBe(sides);
    expect(report.planarity).toBeLessThan(1e-6);
    expect(report.orientation).toBeLessThan(1e-6);
    const expected = Array.from({ length: sides }, (_, index) =>
      sides === 10 ? index : index + 1,
    );
    expect(report.values).toEqual(expected);
    const corners = sides === 6 || sides === 10 ? 4 : sides === 12 ? 5 : 3;
    expect(report.corners.every((count) => count === corners)).toBe(true);
    if (sides !== 4) expect(report.opposite).toBeLessThan(-0.7);
  });
});

describe("layoutThrow", () => {
  it("reads a d10 zero as 10 and a d100 as one die showing that number", () => {
    expect(faceLabel(0, "d10")).toBe("10");
    expect(faceLabel(7, "d10")).toBe("7");
    for (const value of [100, 73, 10, 1]) {
      const pieces = layoutThrow([{ sides: 100, value }], 400);
      expect(pieces).toHaveLength(1);
      const die = pieces[0];
      expect(die?.kind).toBe("die");
      if (die?.kind !== "die") continue;
      expect(faceLabel(die.face, die.mode, die.result)).toBe(String(value));
    }
  });

  it("keeps the dropped die and caps a long pool with a remainder chip", () => {
    const advantage = layoutThrow(
      [
        { sides: 20, value: 18 },
        { sides: 20, value: 4, dropped: true },
      ],
      390,
    );
    expect(advantage).toHaveLength(2);
    expect(advantage[1]).toMatchObject({ kind: "die", face: 4, dropped: true });
    expect((advantage[1] as { radius: number }).radius).toBeLessThan(
      (advantage[0] as { radius: number }).radius,
    );

    const pool = layoutThrow(
      Array.from({ length: 8 }, (_, index) => ({ sides: 6, value: (index % 6) + 1 })),
      390,
    );
    expect(pool).toHaveLength(4);
    expect(pool[3]).toMatchObject({ kind: "chip", extra: 5 });
  });
});
