import { describe, expect, it } from "vitest";
import { timeAgo } from "./time";

describe("timeAgo", () => {
  const now = Date.parse("2026-11-09T20:00:00Z");

  it("speaks recent rolls in short phrases", () => {
    expect(timeAgo(now - 3_000, now)).toBe("just now");
    expect(timeAgo(now - 42_000, now)).toBe("42s ago");
    expect(timeAgo(now - 3 * 60_000, now)).toBe("3 min ago");
    expect(timeAgo(now - 2 * 60 * 60_000, now)).toBe("2 h ago");
  });
});
