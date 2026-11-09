import { createContext, useContext } from "react";
import { ABILITIES, type Ability } from "./conditions";
import {
  DEFAULT_INVENTORY,
  effectLabel,
  itemActive,
  type InventoryItem,
} from "./inventoryData";

/**
 * Gary with no gear. Every number on screen is built from this plus whatever
 * is equipped (and attuned) in the Gear tab.
 */
const BASE = {
  level: 9,
  proficiency: 4,
  /** Point buy + Human + feats. Str 8 is the joke: the belt does the lifting. */
  scores: { str: 8, dex: 16, con: 17, int: 10, wis: 14, cha: 12 } satisfies Record<
    Ability,
    number
  >,
  saveProficiencies: ["str", "con"] as Ability[],
  speed: 30,
  /** Iron Chin: 12 + Con while unarmored */
  ironChin: 12,
  fisticuffsDie: 10,
  /** Pugilist d10 hit die: 10 at level 1 + 6 × 8, plus Tough (+2/level). Con is added per level. */
  hpBeforeCon: 10 + 6 * 8 + 2 * 9,
  skills: [
    { id: "athletics", label: "Athletics", ability: "str" as const, expertise: true },
    { id: "perception", label: "Perception", ability: "wis" as const, expertise: false },
    { id: "insight", label: "Insight", ability: "wis" as const, expertise: false },
  ],
};

export type StatKey =
  | Ability
  | "ac"
  | "attack"
  | "damage"
  | "saves"
  | "checks"
  | "speed"
  | "initiative"
  | "hpMax";

export type GaryStats = {
  level: number;
  scores: Record<Ability, number>;
  mods: Record<Ability, number>;
  attack: number;
  damage: string;
  ac: number;
  athletics: number;
  initiative: number;
  speed: number;
  saves: Record<Ability, number>;
  checks: Record<Ability, number>;
  skills: { id: string; label: string; ability: Ability; bonus: number }[];
  conMod: number;
  fisticuffsDie: number;
  fisticuffsBonus: number;
  braceBonus: number;
  hpMax: number;
  bloodiedAt: number;
  /** Which items are moving each number, e.g. ac → ["Wrist Wraps AC +2"] */
  sources: Partial<Record<StatKey, string[]>>;
};

const mod = (score: number) => Math.floor((score - 10) / 2);

export function computeGary(items: InventoryItem[]): GaryStats {
  const sources: GaryStats["sources"] = {};
  const bonus: Record<
    "ac" | "attack" | "damage" | "saves" | "checks" | "speed" | "initiative",
    number
  > = {
    ac: 0,
    attack: 0,
    damage: 0,
    saves: 0,
    checks: 0,
    speed: 0,
    initiative: 0,
  };
  const scores = { ...BASE.scores };
  const sets: Partial<Record<Ability, { value: number; from: string }>> = {};

  const note = (key: StatKey, text: string) => {
    (sources[key] ??= []).push(text);
  };

  for (const item of items) {
    if (!itemActive(item)) continue;
    for (const effect of item.effects) {
      const text = `${item.name}: ${effectLabel(effect)}`;
      const { target, value } = effect;
      if (target.startsWith("set:")) {
        const ability = target.slice(4) as Ability;
        if (value > (sets[ability]?.value ?? 0)) sets[ability] = { value, from: text };
      } else if (target.startsWith("add:")) {
        const ability = target.slice(4) as Ability;
        scores[ability] += value;
        note(ability, text);
      } else {
        bonus[target as keyof typeof bonus] += value;
        note(target as StatKey, text);
      }
    }
  }

  for (const { id } of ABILITIES) {
    scores[id] = Math.min(30, Math.max(1, scores[id]));
    const set = sets[id];
    if (set && set.value > scores[id]) {
      scores[id] = set.value;
      note(id, set.from);
    }
  }

  const mods = Object.fromEntries(
    ABILITIES.map(({ id }) => [id, mod(scores[id])]),
  ) as Record<Ability, number>;
  const prof = BASE.proficiency;
  const checks = Object.fromEntries(
    ABILITIES.map(({ id }) => [id, mods[id] + bonus.checks]),
  ) as Record<Ability, number>;
  const saves = Object.fromEntries(
    ABILITIES.map(({ id }) => [
      id,
      mods[id] + (BASE.saveProficiencies.includes(id) ? prof : 0) + bonus.saves,
    ]),
  ) as Record<Ability, number>;
  const skills = BASE.skills.map((s) => ({
    id: s.id,
    label: s.label,
    ability: s.ability,
    bonus: mods[s.ability] + prof * (s.expertise ? 2 : 1) + bonus.checks,
  }));
  const fisticuffsBonus = mods.str + bonus.damage;
  const hpMax = Math.max(1, BASE.hpBeforeCon + mods.con * BASE.level);

  if (mods.con !== mod(BASE.scores.con))
    note("hpMax", `Con ${signedNum(mods.con)} × ${BASE.level} levels`);

  return {
    level: BASE.level,
    scores,
    mods,
    attack: mods.str + prof + bonus.attack,
    damage: `${diceText(BASE.fisticuffsDie, fisticuffsBonus)} bludgeoning`,
    ac: BASE.ironChin + mods.con + bonus.ac,
    athletics: skills.find((skill) => skill.id === "athletics")?.bonus ?? 0,
    initiative: mods.dex + bonus.initiative + bonus.checks,
    speed: Math.max(0, BASE.speed + bonus.speed),
    saves,
    checks,
    skills,
    conMod: mods.con,
    fisticuffsDie: BASE.fisticuffsDie,
    fisticuffsBonus,
    braceBonus: BASE.level + mods.con,
    hpMax,
    bloodiedAt: Math.floor(hpMax / 2),
    sources,
  };
}

function signedNum(n: number) {
  return `${n >= 0 ? "+" : "−"}${Math.abs(n)}`;
}

/** Dice notation with an ASCII sign so dice parsers can read it: "1d10+5", "1d10-1". */
export function diceText(sides: number, bonus: number, count = 1) {
  if (bonus === 0) return `${count}d${sides}`;
  return `${count}d${sides}${bonus > 0 ? "+" : "-"}${Math.abs(bonus)}`;
}

/** Gary with nothing equipped, for "what the gear adds" comparisons. */
export const BARE_GARY = computeGary([]);

/** Gary as seeded: belt, wraps, and towel on. */
export const DEFAULT_GARY = computeGary(DEFAULT_INVENTORY.items);

export const GaryContext = createContext<GaryStats>(DEFAULT_GARY);

export function useGary() {
  return useContext(GaryContext);
}
