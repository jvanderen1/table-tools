/** @vitest-environment happy-dom */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useUndoableState } from "./useUndoableState";

describe("useUndoableState", () => {
  it("undoes, redoes, and drops the stack without changing the value", () => {
    const { result } = renderHook(() =>
      useUndoableState("unit-undo", 0, {
        describe: (prev, next) => ({ label: `${prev} → ${next}`, key: String(next) }),
        coalesceMs: 0,
      }),
    );
    act(() => result.current.set(1));
    act(() => result.current.set(2));
    expect(result.current.value).toBe(2);
    expect(result.current.past).toHaveLength(2);

    act(() => result.current.undo());
    expect(result.current.value).toBe(1);
    act(() => result.current.redo());
    expect(result.current.value).toBe(2);

    act(() => result.current.clear());
    expect(result.current.value).toBe(2);
    expect(result.current.past).toHaveLength(0);
  });

  it("merges quick repeats of the same change into one step", () => {
    const { result } = renderHook(() =>
      useUndoableState("unit-coalesce", 0, {
        describe: (prev, next) => ({ label: `${prev} → ${next}`, key: "n" }),
        coalesceMs: 10_000,
      }),
    );
    act(() => result.current.set(1));
    act(() => result.current.set(2));
    expect(result.current.past).toHaveLength(1);
    expect(result.current.past[0]?.label).toBe("0 → 2");
    act(() => result.current.undo());
    expect(result.current.value).toBe(0);
  });
});
