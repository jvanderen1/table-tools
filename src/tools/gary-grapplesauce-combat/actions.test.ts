import { describe, expect, it } from "vitest";
import { ACTIONS, actionAvailable, type GameAction } from "./actions";

const ready = {
  digDeep: true,
  bloodiedUnbowed: true,
  swagger: true,
  guardedMind: true,
  downButNotOut: true,
  exhaustion: 0,
};

function action(id: string): GameAction {
  const found = ACTIONS.find((entry) => entry.id === id);
  if (!found) throw new Error(`missing action ${id}`);
  return found;
}

describe("Gary's action catalog", () => {
  it("refunds Haymaker on a hit and keeps the point on a miss", () => {
    const summary = action("haymaker").summary;
    expect(summary).toMatch(/on a hit/i);
    expect(summary).toMatch(/regain that Moxie/i);
    expect(summary).toMatch(/on a miss, the Moxie stays spent/i);
    expect(summary).not.toMatch(/undo the spend if it misses/i);
  });

  it("restores Dig Deep with no action, and refuses the use at exhaustion 5", () => {
    expect(action("dig-deep-again").part).toBe("free");
    expect(
      actionAvailable(action("dig-deep-again"), {
        ...ready,
        digDeep: false,
        exhaustion: 4,
      }),
    ).toBe(true);
    expect(
      actionAvailable(action("dig-deep-again"), {
        ...ready,
        digDeep: false,
        exhaustion: 5,
      }),
    ).toBe(false);
  });

  it("hides a spent Swagger until the sheet says it is ready", () => {
    expect(actionAvailable(action("swagger"), ready)).toBe(true);
    expect(actionAvailable(action("swagger"), { ...ready, swagger: false })).toBe(false);
  });
});
