/**
 * 2024 condition rules (D&D Beyond free Rules Glossary) and the math that
 * turns active conditions + Exhaustion into Gary's adjusted numbers.
 */

export const PUGILIST_POST_URL =
  "https://www.dndbeyond.com/posts/2130-the-pugilist-class-comes-brawling-onto-d-d-beyond";
export const RULES_GLOSSARY_URL =
  "https://www.dndbeyond.com/sources/dnd/br-2024/rules-glossary";

export const CONDITION_DEFS = [
  {
    id: "blinded",
    label: "Blinded",
    summary:
      "You can’t see and automatically fail any ability check that requires sight. Attack rolls against you have Advantage, and your attack rolls have Disadvantage.",
  },
  {
    id: "charmed",
    label: "Charmed",
    summary:
      "You can’t attack the charmer or target it with damaging abilities or magical effects. The charmer has Advantage on ability checks to interact with you socially.",
  },
  {
    id: "deafened",
    label: "Deafened",
    summary:
      "You can’t hear and automatically fail any ability check that requires hearing.",
  },
  {
    id: "frightened",
    label: "Frightened",
    summary:
      "Disadvantage on ability checks and attack rolls while the source of fear is within line of sight. You can’t willingly move closer to the source of fear.",
  },
  {
    id: "grappled",
    label: "Grappled",
    summary:
      "Speed 0 and can’t increase. Disadvantage on attack rolls against any target other than the grappler. The grappler can drag or carry you (each foot costs it 1 extra foot).",
  },
  {
    id: "incapacitated",
    label: "Incapacitated",
    summary:
      "You can’t take any action, Bonus Action, or Reaction. Your Concentration is broken and you can’t speak. Disadvantage on Initiative if you’re Incapacitated when you roll it.",
  },
  {
    id: "invisible",
    label: "Invisible",
    summary:
      "Advantage on Initiative. You aren’t affected by effects that require their target to be seen. Attack rolls against you have Disadvantage and your attack rolls have Advantage — unless the creature can somehow see you.",
  },
  {
    id: "paralyzed",
    label: "Paralyzed",
    summary:
      "Incapacitated. Speed 0. You automatically fail Strength and Dexterity saves. Attack rolls against you have Advantage, and any hit from within 5 feet is a Critical Hit.",
  },
  {
    id: "petrified",
    label: "Petrified",
    summary:
      "Turned to stone (weight ×10, no aging). Incapacitated, Speed 0. Attack rolls against you have Advantage; you automatically fail Strength and Dexterity saves. Resistance to all damage and Immunity to the Poisoned condition.",
  },
  {
    id: "poisoned",
    label: "Poisoned",
    summary: "Disadvantage on attack rolls and ability checks.",
  },
  {
    id: "prone",
    label: "Prone",
    summary:
      "You can only crawl, or spend half your Speed to stand up (not possible at Speed 0). Disadvantage on your attack rolls. Attacks against you have Advantage from within 5 feet, otherwise Disadvantage.",
  },
  {
    id: "restrained",
    label: "Restrained",
    summary:
      "Speed 0. Attack rolls against you have Advantage, and your attack rolls have Disadvantage. Disadvantage on Dexterity saves.",
  },
  {
    id: "stunned",
    label: "Stunned",
    summary:
      "Incapacitated. You automatically fail Strength and Dexterity saves. Attack rolls against you have Advantage.",
  },
  {
    id: "unconscious",
    label: "Unconscious",
    summary:
      "Incapacitated and Prone; you drop what you’re holding and stay Prone when it ends. Speed 0. Attack rolls against you have Advantage, you automatically fail Strength and Dexterity saves, and any hit from within 5 feet is a Critical Hit.",
  },
] as const;

export type ConditionId = (typeof CONDITION_DEFS)[number]["id"];
export type ConditionFlags = Record<ConditionId, boolean>;

export const EXHAUSTION_DEATH = 6;

export const EXHAUSTION_SUMMARY =
  "Cumulative levels 1–6. Every D20 Test (attacks, checks, saves, Initiative) is reduced by 2 × level, and Speed drops by 5 ft × level. You die at level 6. A Long Rest removes 1 level.";

export function conditionHref(label: string) {
  return `${RULES_GLOSSARY_URL}#${label}Condition`;
}

export type Ability = "str" | "dex" | "con" | "int" | "wis" | "cha";
export const ABILITIES: { id: Ability; label: string }[] = [
  { id: "str", label: "Str" },
  { id: "dex", label: "Dex" },
  { id: "con", label: "Con" },
  { id: "int", label: "Int" },
  { id: "wis", label: "Wis" },
  { id: "cha", label: "Cha" },
];

export type Roll = "advantage" | "disadvantage" | "normal";
export type Reason = { label: string; note?: string };

export type RollEffect = {
  roll: Roll;
  advantage: Reason[];
  disadvantage: Reason[];
};

export type ConditionEffects = {
  /** Anything at all is changing Gary's numbers or options */
  any: boolean;
  dead: boolean;
  d20Penalty: number;
  /** Conditions that stop Actions, Bonus Actions, and Reactions */
  cantAct: Reason[];
  attack: RollEffect;
  checks: RollEffect;
  checkAutoFail: Reason[];
  initiative: RollEffect;
  saves: Record<Ability, { autoFail: Reason[]; effect: RollEffect }>;
  againstNear: RollEffect;
  againstFar: RollEffect;
  autoCritNear: Reason[];
  speed: { value: number; base: number; zeroBy: Reason[]; notes: string[] };
  resistAll: Reason[];
  notes: string[];
};

function rollEffect(advantage: Reason[], disadvantage: Reason[]): RollEffect {
  const roll: Roll =
    advantage.length > 0 && disadvantage.length === 0
      ? "advantage"
      : disadvantage.length > 0 && advantage.length === 0
        ? "disadvantage"
        : "normal";
  return { roll, advantage, disadvantage };
}

const r = (label: string, note?: string): Reason => ({ label, note });

export function computeConditionEffects(
  flags: ConditionFlags,
  exhaustion: number,
  baseSpeed: number,
): ConditionEffects {
  const on = (id: ConditionId) => Boolean(flags[id]);
  const poisoned = on("poisoned") && !on("petrified");
  const prone = on("prone") || on("unconscious");
  const d20Penalty = 2 * exhaustion;

  const cantAct: Reason[] = [];
  for (const id of [
    "incapacitated",
    "paralyzed",
    "petrified",
    "stunned",
    "unconscious",
  ] as const) {
    if (on(id)) cantAct.push(r(label(id)));
  }

  const attackAdv: Reason[] = [];
  const attackDis: Reason[] = [];
  if (on("invisible")) attackAdv.push(r("Invisible", "if they can’t see you"));
  if (on("blinded")) attackDis.push(r("Blinded"));
  if (on("frightened")) attackDis.push(r("Frightened", "while the source is in sight"));
  if (on("grappled")) attackDis.push(r("Grappled", "vs. anyone but the grappler"));
  if (poisoned) attackDis.push(r("Poisoned"));
  if (prone) attackDis.push(r("Prone"));
  if (on("restrained")) attackDis.push(r("Restrained"));

  const checkDis: Reason[] = [];
  if (on("frightened")) checkDis.push(r("Frightened", "while the source is in sight"));
  if (poisoned) checkDis.push(r("Poisoned"));

  const checkAutoFail: Reason[] = [];
  if (on("blinded")) checkAutoFail.push(r("Blinded", "checks that need sight"));
  if (on("deafened")) checkAutoFail.push(r("Deafened", "checks that need hearing"));

  const initAdv: Reason[] = on("invisible") ? [r("Invisible")] : [];
  const blocking = cantAct[0];
  const initDis: Reason[] = blocking ? [r(blocking.label, "Incapacitated")] : [];

  const strDexAutoFail: Reason[] = [];
  for (const id of ["paralyzed", "petrified", "stunned", "unconscious"] as const) {
    if (on(id)) strDexAutoFail.push(r(label(id)));
  }
  const saves = Object.fromEntries(
    ABILITIES.map(({ id }) => {
      const autoFail = id === "str" || id === "dex" ? strDexAutoFail : [];
      const dis = id === "dex" && on("restrained") ? [r("Restrained")] : [];
      return [id, { autoFail, effect: rollEffect([], dis) }];
    }),
  ) as ConditionEffects["saves"];

  const againstAdv: Reason[] = [];
  for (const id of [
    "blinded",
    "paralyzed",
    "petrified",
    "restrained",
    "stunned",
    "unconscious",
  ] as const) {
    if (on(id)) againstAdv.push(r(label(id)));
  }
  const againstDis: Reason[] = on("invisible")
    ? [r("Invisible", "if they can’t see you")]
    : [];
  const againstNear = rollEffect(
    prone ? [...againstAdv, r("Prone", "attacker within 5 ft")] : againstAdv,
    againstDis,
  );
  const againstFar = rollEffect(
    againstAdv,
    prone ? [...againstDis, r("Prone", "attacker beyond 5 ft")] : againstDis,
  );

  const autoCritNear: Reason[] = [];
  if (on("paralyzed")) autoCritNear.push(r("Paralyzed"));
  if (on("unconscious")) autoCritNear.push(r("Unconscious"));

  const zeroBy: Reason[] = [];
  for (const id of [
    "grappled",
    "paralyzed",
    "petrified",
    "restrained",
    "unconscious",
  ] as const) {
    if (on(id)) zeroBy.push(r(label(id)));
  }
  const reduced = Math.max(0, baseSpeed - 5 * exhaustion);
  const speedValue = zeroBy.length > 0 ? 0 : reduced;
  const speedNotes: string[] = [];
  if (prone && speedValue > 0) {
    speedNotes.push(
      `Prone: crawl (1 extra ft per ft) or stand for ${Math.floor(speedValue / 2)} ft`,
    );
  } else if (prone) {
    speedNotes.push("Prone at Speed 0: can’t stand up");
  }
  if (on("frightened")) speedNotes.push("Frightened: can’t move closer to the source");

  const notes: string[] = [];
  if (cantAct.length > 0) {
    notes.push("Concentration broken and can’t speak (Incapacitated)");
  }
  if (on("charmed")) {
    notes.push(
      "Charmed: can’t attack or target the charmer; it has Advantage on social checks vs. you",
    );
  }
  if (on("unconscious")) notes.push("Unconscious: drop what you’re holding");
  if (on("petrified") && on("poisoned")) {
    notes.push("Petrified: immune to Poisoned, so Poisoned is ignored");
  }

  const resistAll: Reason[] = on("petrified") ? [r("Petrified")] : [];

  const anyCondition = Object.values(flags).some(Boolean);

  return {
    any: anyCondition || exhaustion > 0,
    dead: exhaustion >= EXHAUSTION_DEATH,
    d20Penalty,
    cantAct,
    attack: rollEffect(attackAdv, attackDis),
    checks: rollEffect([], checkDis),
    checkAutoFail,
    initiative: rollEffect(initAdv, initDis),
    saves,
    againstNear,
    againstFar,
    autoCritNear,
    speed: { value: speedValue, base: baseSpeed, zeroBy, notes: speedNotes },
    resistAll,
    notes,
  };
}

function label(id: ConditionId) {
  return CONDITION_DEFS.find((c) => c.id === id)?.label ?? id;
}
