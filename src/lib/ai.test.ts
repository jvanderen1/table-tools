import { beforeEach, describe, expect, it, vi } from "vitest";
import { listModels, loadAiSettings, saveAiSettings, suggestModel } from "./ai";

const memory = new Map<string, string>();

beforeEach(() => {
  memory.clear();
  vi.unstubAllGlobals();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
    removeItem: (key: string) => memory.delete(key),
  });
});

describe("AI settings", () => {
  it("prefers the sharper free Groq model and drops speech models", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: [
            { id: "whisper-large-v3" },
            { id: "openai/gpt-oss-120b" },
            { id: "openai/gpt-oss-20b" },
            { id: "meta-llama/llama-prompt-guard-2-22m" },
          ],
        }),
      })),
    );
    const ids = await listModels("groq", "gsk_test");
    expect(ids).toEqual(["openai/gpt-oss-20b", "openai/gpt-oss-120b"]);
    expect(suggestModel("groq", ids)).toBe("openai/gpt-oss-120b");
  });

  it("moves a saved retired Groq model onto the current free default", () => {
    saveAiSettings({
      provider: "groq",
      apiKey: "gsk_test",
      model: "llama-3.1-8b-instant",
    });
    expect(loadAiSettings()?.model).toBe("openai/gpt-oss-120b");
    saveAiSettings(null);
    expect(loadAiSettings()).toBeNull();
  });

  it("ignores a stored provider it does not know", () => {
    localStorage.setItem(
      "table-tools-secret:ai",
      JSON.stringify({ provider: "pi", apiKey: "x", model: "local" }),
    );
    expect(loadAiSettings()).toBeNull();
  });
});
