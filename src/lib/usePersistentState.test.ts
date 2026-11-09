/** @vitest-environment happy-dom */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePersistentState } from "./usePersistentState";

describe("usePersistentState", () => {
  it("reads a saved value and writes the next one", () => {
    localStorage.setItem("table-tools:unit-persist", JSON.stringify("kept"));
    const { result, rerender } = renderHook(() =>
      usePersistentState("unit-persist", "fresh"),
    );
    expect(result.current[0]).toBe("kept");
    act(() => result.current[1]("next"));
    rerender();
    expect(localStorage.getItem("table-tools:unit-persist")).toBe(JSON.stringify("next"));
  });

  it("falls back when the saved text is not JSON", () => {
    localStorage.setItem("table-tools:unit-bad", "{");
    const { result } = renderHook(() => usePersistentState("unit-bad", 4));
    expect(result.current[0]).toBe(4);
  });
});
