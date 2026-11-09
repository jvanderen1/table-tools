import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBackup, parseBackup, restoreBackup, savedKeys } from "./backup";

/** Object.keys(localStorage) is how the backup lists saved entries. */
function storage() {
  const bag = new Map<string, string>();
  return new Proxy({} as Storage, {
    ownKeys: () => [...bag.keys()],
    getOwnPropertyDescriptor: (_target, prop) => {
      if (typeof prop === "string" && bag.has(prop)) {
        return { enumerable: true, configurable: true, value: bag.get(prop) };
      }
      return undefined;
    },
    get: (_target, prop) => {
      if (prop === "getItem") return (key: string) => bag.get(key) ?? null;
      if (prop === "setItem")
        return (key: string, value: string) => bag.set(key, String(value));
      if (prop === "removeItem") return (key: string) => bag.delete(key);
      if (prop === "length") return bag.size;
      return undefined;
    },
  });
}

beforeEach(() => {
  vi.stubGlobal("localStorage", storage());
});

describe("backups", () => {
  it("saves table data and leaves the AI key out", () => {
    localStorage.setItem("table-tools:gary-grapplesauce-combat:sheet", '{"hp":40}');
    localStorage.setItem("table-tools-secret:ai", '{"apiKey":"secret"}');
    const text = createBackup();
    expect(text).toContain("table-tools:gary-grapplesauce-combat:sheet");
    expect(text).not.toContain("secret");
    expect(savedKeys()).toEqual(["table-tools:gary-grapplesauce-combat:sheet"]);
  });

  it("rejects a file that is not a backup", () => {
    expect(() => parseBackup("not json")).toThrow(/valid backup text/);
    expect(() => parseBackup('{"app":"other","data":{}}')).toThrow(/Table Tools backup/);
    expect(() => parseBackup('{"app":"table-tools","data":{"other": "x"}}')).toThrow(
      /Unexpected entry/,
    );
  });

  it("replaces saved keys with the backup and drops ones it does not contain", () => {
    localStorage.setItem("table-tools:old", "1");
    const file = parseBackup(
      JSON.stringify({
        app: "table-tools",
        version: 1,
        exportedAt: "2026-11-09T00:00:00.000Z",
        data: { "table-tools:kept": "2" },
      }),
    );
    restoreBackup(file);
    expect(localStorage.getItem("table-tools:old")).toBeNull();
    expect(localStorage.getItem("table-tools:kept")).toBe("2");
    expect(localStorage.getItem("table-tools-secret:ai")).toBeNull();
  });
});
