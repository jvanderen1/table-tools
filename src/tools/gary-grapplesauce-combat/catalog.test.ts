import { describe, expect, it } from "vitest";
import { ACTIONS } from "./actions";
import { GLOSSARY, TIP_ALIASES } from "./glossary";
import { PLAYBOOKS } from "./playbooks";
import { getTool, tools } from "../registry";

describe("playbooks and glossary", () => {
  it("only names actions that exist in the catalog", () => {
    const ids = new Set(ACTIONS.map((action) => action.id));
    for (const book of PLAYBOOKS) {
      for (const id of book.actionIds) {
        expect(ids.has(id), `${book.id} names ${id}`).toBe(true);
      }
    }
  });

  it("points every tooltip alias at a glossary entry", () => {
    for (const [label, id] of Object.entries(TIP_ALIASES)) {
      expect(GLOSSARY[id]?.summary, label).toBeTruthy();
    }
    expect(GLOSSARY["haymaker"]?.summary).toMatch(/on a miss, the Moxie stays spent/i);
  });
});

describe("tool registry", () => {
  it("publishes Gary and nothing else under that id", () => {
    expect(tools.map((tool) => tool.meta.id)).toContain("gary-grapplesauce-combat");
    expect(getTool("gary-grapplesauce-combat")?.meta.title).toMatch(/Gary/);
    expect(getTool("missing")).toBeUndefined();
  });
});
