import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { usePersistentState } from "../../lib/usePersistentState";
import {
  Button,
  Callout,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Pill,
  Row,
  Stack,
  Text,
} from "../../ui";
import {
  ABILITIES,
  CONDITION_DEFS,
  EXHAUSTION_DEATH,
  EXHAUSTION_SUMMARY,
  PUGILIST_POST_URL,
  RULES_GLOSSARY_URL,
  computeConditionEffects,
  conditionHref,
  type Ability,
  type ConditionEffects,
  type ConditionFlags,
  type ConditionId,
  type Reason,
  type RollEffect,
} from "./conditions";
import { GLOSSARY } from "./glossary";
import { GlossaryList, Tip } from "./Tip";

type Phase = "timing" | "reaction" | "goal" | "result";
type Timing = "turn" | "reaction" | "check-fail";
type ReactionKind = "bloodied" | "mage-cast" | "opportunity" | "other";
type Goal =
  | "damage"
  | "control"
  | "survive"
  | "reposition"
  | "mage"
  | "unsure";

type Plan = {
  title: string;
  action: string;
  bonus: string;
  reaction?: string;
  cost: number;
  costLabel: string;
  why: string;
  gym: string;
  /** What “Apply” does to the tracker */
  apply?:
    | "moxie"
    | "bloodied-unbowed"
    | "dig-deep"
    | "dig-deep-exhaustion"
    | "swagger"
    | "none";
};

type Sheet = {
  moxie: number;
  hp: number;
  tempHp: number;
  /** Remaining uses — true = still available */
  digDeep: boolean;
  digDeepActive: boolean;
  bloodiedUnbowed: boolean;
  swagger: boolean;
  conditions: ConditionFlags;
  /** 0 = none, 1–6 = Exhaustion level */
  exhaustion: number;
  /** Unspent Pugilist hit dice (d10), max 9 */
  hitDice: number;
};

const MOXIE_MAX = 5;
const HP_MAX = 103;
const BLOODIED_AT = Math.floor(HP_MAX / 2); // ≤ 51
/** Pugilist d10, one per level. A 2024 Long Rest refills all of them. */
const HIT_DICE_MAX = 9;
/** Swagger Streak adds 1d10 to a failed Str/Dex/Con/Cha check. */
const SWAGGER_ABILITIES = new Set<Ability>(["str", "dex", "con", "cha"]);

function emptyConditions(): ConditionFlags {
  return Object.fromEntries(
    CONDITION_DEFS.map((c) => [c.id, false]),
  ) as ConditionFlags;
}

const DEFAULT_SHEET: Sheet = {
  moxie: MOXIE_MAX,
  hp: HP_MAX,
  tempHp: 0,
  digDeep: true,
  digDeepActive: false,
  bloodiedUnbowed: true,
  swagger: true,
  conditions: emptyConditions(),
  exhaustion: 0,
  hitDice: HIT_DICE_MAX,
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalizeSheet(raw: Sheet): Sheet {
  return {
    ...DEFAULT_SHEET,
    ...raw,
    conditions: { ...emptyConditions(), ...(raw.conditions ?? {}) },
    exhaustion: clamp(raw.exhaustion ?? 0, 0, 6),
    hitDice: clamp(raw.hitDice ?? HIT_DICE_MAX, 0, HIT_DICE_MAX),
  };
}

function activeConditions(sheet: Sheet) {
  return CONDITION_DEFS.filter((c) => sheet.conditions?.[c.id]);
}

/** Live D&D Beyond numbers with attuned items (Towel adds +1 to every save) */
const GARY = {
  attack: 9,
  damage: "1d10+5 bludgeoning",
  ac: 18,
  athletics: 13,
  initiative: 3,
  speed: 30,
  /** Saves include the Towel’s +1. Checks do not. */
  saves: { str: 10, dex: 4, con: 8, int: 1, wis: 3, cha: 2 } satisfies Record<
    Ability,
    number
  >,
  checks: { str: 5, dex: 3, con: 3, int: 0, wis: 2, cha: 1 } satisfies Record<
    Ability,
    number
  >,
  skills: [
    { id: "athletics", label: "Athletics", ability: "str" as const, bonus: 13 },
    { id: "perception", label: "Perception", ability: "wis" as const, bonus: 6 },
    { id: "insight", label: "Insight", ability: "wis" as const, bonus: 6 },
  ],
  conMod: 3,
  /** Unarmed damage and Brace Up both use the d10 Fisticuffs die */
  fisticuffsDie: 10,
  fisticuffsBonus: 5,
  braceBonus: 12,
};

/** Re-using Dig Deep costs 1 Exhaustion; reaching level 6 kills Gary. */
function canDigDeepAgain(exhaustion: number) {
  return exhaustion + 1 < EXHAUSTION_DEATH;
}

function digDeepAgainNote(exhaustion: number) {
  return canDigDeepAgain(exhaustion)
    ? `again costs 1 Exhaustion (→ ${exhaustion + 1}).`
    : `again would be Exhaustion ${EXHAUSTION_DEATH}: Gary dies. Don’t.`;
}

function effectsFor(sheet: Sheet): ConditionEffects {
  return computeConditionEffects(
    sheet.conditions,
    sheet.exhaustion ?? 0,
    GARY.speed,
  );
}

function signed(n: number) {
  return n >= 0 ? `+${n}` : `−${Math.abs(n)}`;
}

const ROLL_SHORT = {
  advantage: "Adv",
  disadvantage: "Dis",
  normal: "",
} as const;

function reasonText(reasons: Reason[]) {
  return reasons
    .map((x) => (x.note ? `${x.label} (${x.note})` : x.label))
    .join(", ");
}

type GoalOption = {
  id: Goal;
  label: string;
  cost: number;
  variant: "primary" | "secondary" | "ghost";
};

const GOAL_OPTIONS: GoalOption[] = [
  { id: "damage", label: "Deal damage", cost: 0, variant: "primary" },
  { id: "control", label: "Grapple / control", cost: 0, variant: "secondary" },
  { id: "survive", label: "Survive", cost: 0, variant: "secondary" },
  {
    id: "reposition",
    label: "Move / close gap (Stick and Move)",
    cost: 1,
    variant: "secondary",
  },
  { id: "mage", label: "Stop a caster", cost: 0, variant: "secondary" },
  { id: "unsure", label: "Not sure", cost: 0, variant: "ghost" },
];

function isBloodied(hp: number) {
  return hp > 0 && hp <= BLOODIED_AT;
}

function planFor(goal: Goal, sheet: Sheet): Plan {
  const canSpend = sheet.moxie >= 1;

  switch (goal) {
    case "damage":
      return canSpend
        ? {
            title: "Damage focus",
            action:
              "Attack → Unarmed Strike. On hit, Heavy Hitter: deal damage and Grapple or Shove.",
            bonus: "One-Two Punch (1 Moxie): two more Unarmed Strikes.",
            cost: 1,
            costLabel: "1",
            why: "Action punch + Heavy Hitter, then burst with One-Two while you have Moxie.",
            gym: 'The One-Two. "Cardio."',
            apply: "moxie",
          }
        : {
            title: "Damage focus (no Moxie)",
            action:
              "Attack → Unarmed Strike. On hit, Heavy Hitter: deal damage and Grapple or Shove.",
            bonus: "Fisticuffs free Unarmed Strike (no Moxie).",
            cost: 0,
            costLabel: "0",
            why: "Same Action loop; free BA punch only until you regain Moxie.",
            gym: 'The One-Two. "Cardio."',
            apply: "none",
          };
    case "control":
      return {
        title: "Lock them down",
        action:
          "Attack → Unarmed. On hit, Stop and Drop: Grapple and Shove (no mastery).",
        bonus: canSpend
          ? "Hold Inescapable for their escape attempt (1 Moxie). Until then, Fisticuffs Unarmed or shove prone."
          : "Fisticuffs Unarmed, or shove prone if already grappled. Inescapable locked until you have 1 Moxie.",
        cost: 0,
        costLabel: canSpend ? "0 now · 1 later" : "0",
        why: "Compression Lock deals 1d10+5 at the start of your turns while you hold them.",
        gym: "Sit Down. Still Hugging.",
        apply: "none",
      };
    case "survive":
      if (canSpend) {
        return {
          title: "Stay standing",
          action:
            "Attack only if safe. Prefer holding position or Disengaging later.",
          bonus: sheet.digDeep
            ? "Brace Up (1 Moxie): temp HP = 1d10 + 12. Dig Deep still available (1/long rest)."
            : `Brace Up (1 Moxie): temp HP = 1d10 + 12. Dig Deep already used — ${digDeepAgainNote(sheet.exhaustion)}`,
          reaction: sheet.bloodiedUnbowed
            ? "If bloodied and you take damage: Bloodied But Unbowed still available."
            : "Bloodied But Unbowed already used this short rest.",
          cost: 1,
          costLabel: "1",
          why: "Temp HP now. Dig Deep is free but once per long rest.",
          gym: "Flex. Leg Day.",
          apply: "moxie",
        };
      }
      if (sheet.digDeep) {
        return {
          title: "Stay standing — Dig Deep",
          action:
            "Attack only if safe. Hold position behind allies if possible.",
          bonus:
            "Dig Deep (1/long rest): resistance to B/P/S for 10 minutes. Brace Up locked (no Moxie).",
          cost: 0,
          costLabel: "0 · Dig Deep",
          why: "No Brace Up without Moxie. Burn Dig Deep if the fight is brutal.",
          gym: "Leg Day.",
          apply: "dig-deep",
        };
      }
      if (!sheet.digDeepActive && canDigDeepAgain(sheet.exhaustion)) {
        const next = sheet.exhaustion + 1;
        return {
          title: "Stay standing — Dig Deep again",
          action:
            "Attack only if safe. Hold position behind allies if possible.",
          bonus: `Dig Deep again by taking 1 Exhaustion (${sheet.exhaustion} → ${next}): resistance to B/P/S.`,
          cost: 0,
          costLabel: "+1 Exhaustion",
          why:
            next === EXHAUSTION_DEATH - 1
              ? `Exhaustion ${next} is one level from death (−${2 * next} to d20 tests, −${5 * next} ft). Only if the alternative is going down.`
              : `Exhaustion ${next}: −${2 * next} to every d20 test and −${5 * next} ft speed until long rests clear it.`,
          gym: "One More Rep.",
          apply: "dig-deep-exhaustion",
        };
      }
      return {
        title: "Stay standing (no tools left)",
        action:
          "Attack only if safe. Hold position behind allies if possible.",
        bonus: `Brace Up locked (no Moxie). Dig Deep already used — ${digDeepAgainNote(sheet.exhaustion)} ${
          sheet.bloodiedUnbowed
            ? "Hope for Bloodied But Unbowed or cover."
            : "Find cover."
        }`,
        cost: 0,
        costLabel: "0",
        why: "You’re on fumes — play scared and wait for a rest or refill reaction.",
        gym: "Breathe.",
        apply: "none",
      };
    case "reposition":
      return {
        title: "Close or bounce",
        action:
          "Attack if in reach after Stick and Move; otherwise arrive ready for next turn.",
        bonus: "Stick and Move (1 Moxie): Unarmed Strike + Dash or Disengage.",
        cost: 1,
        costLabel: "1",
        why: "One resource buys offense and movement without burning your Action on Dash alone.",
        gym: "Bounce, don't plant.",
        apply: "moxie",
      };
    case "mage":
      return canSpend
        ? {
            title: "Shut down the caster",
            action:
              "Get adjacent. Attack with advantage from Mage Slayer when they cast. Grapple if you can keep them stuck.",
            bonus:
              "Stick and Move (1 Moxie) to close, or One-Two (1 Moxie) once adjacent.",
            reaction:
              "When a creature within 5 ft casts a spell with a spell slot: Mage Slayer reaction Unarmed Strike.",
            cost: 1,
            costLabel: "1",
            why: "Spend Moxie to get on them or burst once you're there.",
            gym: "HEY. Soften the wizard.",
            apply: "moxie",
          }
        : {
            title: "Shut down the caster (no Moxie)",
            action:
              "Dash or move adjacent with your Action/movement. Attack if you arrive. Grapple if you can.",
            bonus: "Fisticuffs Unarmed once you're on them.",
            reaction:
              "When a creature within 5 ft casts a spell with a spell slot: Mage Slayer reaction Unarmed Strike.",
            cost: 0,
            costLabel: "0",
            why: "Stick and Move / One-Two locked. Still interrupt with Mage Slayer.",
            gym: "HEY. Soften the wizard.",
            apply: "none",
          };
    default:
      return {
        title: "Default loop",
        action:
          "Attack → Unarmed. Heavy Hitter on hit (damage + Grapple or Shove).",
        bonus: "Fisticuffs free Unarmed Strike. Save Moxie for a bad turn.",
        cost: 0,
        costLabel: "0",
        why: "Punch, hug, repeat. Spend Moxie only when the board state demands it.",
        gym: "If unsure: punch, then offer a spot.",
        apply: "none",
      };
  }
}

function reactionPlan(kind: ReactionKind): Plan {
  switch (kind) {
    case "bloodied":
      return {
        title: "Bloodied But Unbowed",
        action: "No Action — this is a Reaction.",
        bonus: "—",
        reaction:
          "Spend your Reaction: regain all Moxie Points and gain 36 temporary HP (1/short rest).",
        cost: 0,
        costLabel: "refill Moxie + 36 temp",
        why: "Only when you take damage while bloodied. Biggest swing button in the kit.",
        gym: "Not done. Spot me.",
        apply: "bloodied-unbowed",
      };
    case "mage-cast":
      return {
        title: "Mage Slayer interrupt",
        action: "No Action — this is a Reaction.",
        bonus: "—",
        reaction:
          "Creature within 5 ft casts with a spell slot → Reaction Unarmed Strike (+9 / 1d10+5). Next turn, stay adjacent.",
        cost: 0,
        costLabel: "0",
        why: "Interrupt first. Follow up by grappling them so they can't walk off.",
        gym: "HEY.",
        apply: "none",
      };
    case "opportunity":
      return {
        title: "Opportunity Attack",
        action: "No Action — this is a Reaction.",
        bonus: "—",
        reaction: "Unarmed Strike. Save Grapple / Stop and Drop for your turn.",
        cost: 0,
        costLabel: "0",
        why: "Punish leaving your reach.",
        gym: "Where you going?",
        apply: "none",
      };
    default:
      return {
        title: "Hold the Reaction",
        action: "No forced Reaction.",
        bonus: "—",
        reaction:
          "Keep Reaction free for Bloodied But Unbowed or Mage Slayer unless an OA is clearly better.",
        cost: 0,
        costLabel: "0",
        why: "Your two signature Reactions are high value. Don't spend casually.",
        gym: "Save the flex.",
        apply: "none",
      };
  }
}

type LineDie = "attack" | "damage" | "brace" | "swagger";

/** Dice buttons that belong on one Action / Bonus / Reaction line. */
function lineDice(text: string): LineDie[] {
  const dice: LineDie[] = [];
  const noAction = /^(no action|no forced|—)/i.test(text.trim());
  if (!noAction && /unarmed|attack|punch/i.test(text)) {
    dice.push("attack", "damage");
  }
  if (/brace up/i.test(text) && !/locked/i.test(text)) dice.push("brace");
  if (/add 1d10/i.test(text)) dice.push("swagger");
  return dice;
}

function checkFailPlan(swaggerAvailable: boolean): Plan {
  if (!swaggerAvailable) {
    return {
      title: "Swagger Streak already used",
      action: "No Action — Swagger Streak is spent until a short rest.",
      bonus: "—",
      cost: 0,
      costLabel: "0",
      why: "Take the fail, or hope for Help / advantage from an ally.",
      gym: "Shake it off.",
      apply: "none",
    };
  }
  return {
    title: "Swagger Streak",
    action: "No Action — after you fail a Str, Dex, Con, or Cha check.",
    bonus: "—",
    reaction: "Add 1d10 to the failed check (1/short rest).",
    cost: 0,
    costLabel: "0 · 1/SR",
    why: "Use on Athletics grapples/shoves or key Str/Dex/Con/Cha checks you can't afford to miss.",
    gym: "One more rep.",
    apply: "swagger",
  };
}

const DAMAGE_TYPES = [
  "bludgeoning",
  "piercing",
  "slashing",
  "acid",
  "cold",
  "fire",
  "force",
  "lightning",
  "necrotic",
  "poison",
  "psychic",
  "radiant",
  "thunder",
] as const;

type DamageType = (typeof DAMAGE_TYPES)[number];
type Effectiveness = "auto" | "normal" | "resistant" | "immune" | "vulnerable";

type DamageUi = {
  amount: string;
  type: DamageType;
  effectiveness: Effectiveness;
  increments: number[];
  customIncrement: string;
};

const DEFAULT_DAMAGE_UI: DamageUi = {
  amount: "0",
  type: "bludgeoning",
  effectiveness: "auto",
  increments: [1, 5, 10, 20],
  customIncrement: "15",
};

type DamageOutcome = {
  tone: "info" | "warning";
  title: string;
  detail: string;
};

function isWeaponPhysical(type: DamageType) {
  return (
    type === "bludgeoning" || type === "piercing" || type === "slashing"
  );
}

function autoResistReason(sheet: Sheet, type: DamageType): string | null {
  if (sheet.conditions.petrified) return "Petrified";
  if (sheet.digDeepActive && isWeaponPhysical(type)) return "Dig Deep";
  return null;
}

function resolveEffectiveness(
  type: DamageType,
  sheet: Sheet,
  mode: Effectiveness,
): Exclude<Effectiveness, "auto"> {
  if (mode !== "auto") return mode;
  return autoResistReason(sheet, type) ? "resistant" : "normal";
}

function modifyDamage(
  raw: number,
  eff: Exclude<Effectiveness, "auto">,
): number {
  if (eff === "immune") return 0;
  if (eff === "resistant") return Math.floor(raw / 2);
  if (eff === "vulnerable") return raw * 2;
  return raw;
}

function applyIncomingDamage(
  hp: number,
  tempHp: number,
  finalDamage: number,
): { hp: number; tempHp: number; absorbedByTemp: number; toHp: number } {
  let remaining = finalDamage;
  let nextTemp = tempHp;
  let absorbedByTemp = 0;
  if (nextTemp > 0 && remaining > 0) {
    absorbedByTemp = Math.min(nextTemp, remaining);
    nextTemp -= absorbedByTemp;
    remaining -= absorbedByTemp;
  }
  return {
    hp: clamp(hp - remaining, 0, HP_MAX),
    tempHp: nextTemp,
    absorbedByTemp,
    toHp: remaining,
  };
}

function DamageAdjuster({
  sheet,
  setSheet,
}: {
  sheet: Sheet;
  setSheet: (next: Sheet | ((prev: Sheet) => Sheet)) => void;
}) {
  const [ui, setUi] = usePersistentState<DamageUi>(
    "gary-grapplesauce-combat:damage-ui",
    DEFAULT_DAMAGE_UI,
  );
  const [outcome, setOutcome] = useState<DamageOutcome | null>(null);

  const raw = Math.max(0, Number.parseInt(ui.amount || "0", 10) || 0);
  const resolved = resolveEffectiveness(ui.type, sheet, ui.effectiveness);
  const autoReason = autoResistReason(sheet, ui.type);
  const preview = modifyDamage(raw, resolved);

  function setAmount(next: string) {
    const cleaned = next.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
    setUi((u) => ({ ...u, amount: cleaned === "" ? "0" : cleaned }));
  }

  function bump(delta: number) {
    setAmount(String(Math.max(0, raw + delta)));
  }

  function onAmountKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" || e.key === "Delete") return;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      bump(1);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      bump(-1);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      takeDamage();
      return;
    }
    if (e.key.length === 1 && !/\d/.test(e.key) && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
    }
  }

  function addIncrementPreset() {
    const n = Number.parseInt(ui.customIncrement || "0", 10);
    if (!n || n <= 0) return;
    setUi((u) => ({
      ...u,
      increments: [...new Set([...u.increments, n])].sort((a, b) => a - b),
    }));
  }

  function takeDamage() {
    const finalDamage = preview;
    const before = { hp: sheet.hp, tempHp: sheet.tempHp };
    const after = applyIncomingDamage(sheet.hp, sheet.tempHp, finalDamage);
    setSheet((s) => ({ ...s, hp: after.hp, tempHp: after.tempHp }));

    let title = "Damage applied";
    let tone: "info" | "warning" = "info";
    if (resolved === "immune") {
      title = "Immune — no damage";
      tone = "warning";
    } else if (resolved === "resistant") {
      title = "Resistant — half damage";
      tone = "info";
    } else if (resolved === "vulnerable") {
      title = "Vulnerable — double damage";
      tone = "warning";
    }

    const bits = [
      `${raw} ${ui.type}`,
      resolved !== "normal" ? `${resolved} → ${finalDamage}` : `${finalDamage} taken`,
    ];
    if (after.absorbedByTemp > 0) {
      bits.push(`${after.absorbedByTemp} absorbed by temp HP`);
    }
    if (after.toHp > 0) {
      bits.push(`${after.toHp} to HP (${before.hp} → ${after.hp})`);
    } else if (finalDamage > 0 && after.absorbedByTemp > 0) {
      bits.push(`HP unchanged at ${after.hp}`);
    }
    if (isBloodied(after.hp) && !isBloodied(before.hp)) {
      bits.push(`now bloodied (≤${BLOODIED_AT})`);
    }
    if (autoReason && ui.effectiveness === "auto") {
      bits.push(`${autoReason} resistance applied`);
    }

    setOutcome({ tone, title, detail: bits.join(" · ") });
  }

  function heal() {
    if (raw <= 0) {
      setOutcome({
        tone: "warning",
        title: "Nothing to heal",
        detail: "Enter an amount greater than 0.",
      });
      return;
    }
    const next = clamp(sheet.hp + raw, 0, HP_MAX);
    setSheet((s) => ({ ...s, hp: next }));
    setOutcome({
      tone: "info",
      title: "Healed",
      detail: `+${raw} HP (${sheet.hp} → ${next}). Damage type ignored for healing.`,
    });
  }

  const effHint =
    ui.effectiveness === "auto"
      ? autoReason
        ? `${autoReason} → resistant`
        : "Normal"
      : ui.effectiveness;

  return (
    <Stack gap={14}>
      <Text tone="secondary">
        Type the total, pick the type, then Take damage. Enter applies.
      </Text>

      <div className="hit-row">
        <label className="field hit-amount">
          <span className="field-label">Amount</span>
          <input
            className="field-input amount-input"
            inputMode="numeric"
            pattern="[0-9]*"
            value={ui.amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={onAmountKeyDown}
            aria-label="Damage or heal amount"
            autoFocus
          />
        </label>
        <label className="field hit-type">
          <span className="field-label">Type</span>
          <select
            className="field-input"
            value={ui.type}
            onChange={(e) =>
              setUi((u) => ({ ...u, type: e.target.value as DamageType }))
            }
          >
            {DAMAGE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Text tone="tertiary">
        {raw} → {preview} {ui.type} ({effHint})
        {sheet.tempHp > 0 ? ` · temp ${sheet.tempHp} first` : ""}
      </Text>

      <Row gap={8} wrap>
        <Button variant="primary" onClick={takeDamage}>
          Take damage
        </Button>
        <Button variant="secondary" onClick={heal}>
          Heal
        </Button>
      </Row>

      {outcome ? (
        <Callout tone={outcome.tone} title={outcome.title}>
          {outcome.detail}
        </Callout>
      ) : null}

      <details className="more-details">
        <summary>More damage options</summary>
        <Stack gap={12}>
          <label className="field">
            <span className="field-label">Override vs Gary</span>
            <select
              className="field-input"
              value={ui.effectiveness}
              onChange={(e) =>
                setUi((u) => ({
                  ...u,
                  effectiveness: e.target.value as Effectiveness,
                }))
              }
            >
              <option value="auto">Auto (Dig Deep if B/P/S)</option>
              <option value="normal">Normal</option>
              <option value="resistant">Resistant (½)</option>
              <option value="immune">Immune (0)</option>
              <option value="vulnerable">Vulnerable (×2)</option>
            </select>
          </label>

          <Row gap={8} wrap>
            {ui.increments.map((n) => (
              <Button key={n} variant="secondary" onClick={() => bump(n)}>
                +{n}
              </Button>
            ))}
            {ui.increments.map((n) => (
              <Button key={`m${n}`} variant="ghost" onClick={() => bump(-n)}>
                −{n}
              </Button>
            ))}
          </Row>

          <Row gap={8} wrap align="center">
            <input
              className="field-input step-input"
              inputMode="numeric"
              value={ui.customIncrement}
              onChange={(e) =>
                setUi((u) => ({
                  ...u,
                  customIncrement: e.target.value.replace(/\D/g, ""),
                }))
              }
              aria-label="Custom increment value"
            />
            <Button
              variant="ghost"
              onClick={() =>
                bump(Number.parseInt(ui.customIncrement || "0", 10) || 0)
              }
            >
              +step
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                bump(-(Number.parseInt(ui.customIncrement || "0", 10) || 0))
              }
            >
              −step
            </Button>
            <Button variant="ghost" onClick={addIncrementPreset}>
              Save step
            </Button>
          </Row>

          <Row gap={8} wrap>
            <Text tone="secondary">Temp HP: {sheet.tempHp}</Text>
            <Button
              variant="ghost"
              onClick={() =>
                setSheet((s) => ({ ...s, tempHp: s.tempHp + raw }))
              }
            >
              Add amount as temp
            </Button>
            <Button
              variant="ghost"
              disabled={sheet.tempHp <= 0}
              onClick={() => setSheet((s) => ({ ...s, tempHp: 0 }))}
            >
              Clear temp
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                setSheet((s) => ({ ...s, hp: HP_MAX, tempHp: 0 }))
              }
            >
              Full HP
            </Button>
          </Row>
        </Stack>
      </details>
    </Stack>
  );
}

function PlanTips({ plan }: { plan: Plan }) {
  const ids: (keyof typeof GLOSSARY)[] = [];
  const blob = `${plan.title} ${plan.action} ${plan.bonus} ${plan.reaction ?? ""}`;
  if (/Dig Deep/i.test(blob)) ids.push("dig-deep");
  if (/Brace Up/i.test(blob)) ids.push("brace-up");
  if (/Bloodied But Unbowed|Bloodied/i.test(blob)) ids.push("bloodied-but-unbowed");
  if (/One-Two/i.test(blob)) ids.push("one-two");
  if (/Stick and Move/i.test(blob)) ids.push("stick-and-move");
  if (/Heavy Hitter/i.test(blob)) ids.push("heavy-hitter");
  if (/Fisticuffs/i.test(blob)) ids.push("fisticuffs");
  if (/Stop and Drop/i.test(blob)) ids.push("stop-and-drop");
  if (/Inescapable/i.test(blob)) ids.push("inescapable");
  if (/Compression Lock/i.test(blob)) ids.push("compression-lock");
  if (/Swagger/i.test(blob)) ids.push("swagger-streak");
  if (/Moxie/i.test(blob)) ids.push("moxie");

  const unique = [...new Set(ids)];
  if (unique.length === 0) return null;

  return (
    <Row gap={8} wrap>
      <Text tone="tertiary">Tips:</Text>
      {unique.map((id) => (
        <Tip key={id} id={id}>
          {GLOSSARY[id].label}
        </Tip>
      ))}
    </Row>
  );
}

function StatusPills({ sheet }: { sheet: Sheet }) {
  const active: ReactNode[] = [];
  if (isBloodied(sheet.hp)) {
    active.push(
      <Pill key="bloodied" active>
        <Tip id="bloodied">Bloodied</Tip>
      </Pill>,
    );
  }
  if (sheet.digDeepActive) {
    active.push(
      <Pill key="dig-active" active>
        <Tip id="dig-deep">Dig Deep on</Tip>
      </Pill>,
    );
  }
  if ((sheet.exhaustion ?? 0) > 0) {
    active.push(
      <Pill key="exhaustion" active>
        <Tip id="exhaustion">Exhaustion {sheet.exhaustion}</Tip>
      </Pill>,
    );
  }
  for (const c of activeConditions(sheet)) {
    active.push(
      <Pill key={c.id} active>
        <Tip id={`cond-${c.id}`}>{c.label}</Tip>
      </Pill>,
    );
  }

  const ready: ReactNode[] = [];
  if (sheet.bloodiedUnbowed) {
    ready.push(
      <Pill key="bbu">
        <Tip id="bloodied-but-unbowed">Bloodied But Unbowed</Tip>
      </Pill>,
    );
  }
  if (sheet.swagger) {
    ready.push(
      <Pill key="swagger">
        <Tip id="swagger-streak">Swagger Streak</Tip>
      </Pill>,
    );
  }
  if (sheet.digDeep && !sheet.digDeepActive) {
    ready.push(
      <Pill key="dig">
        <Tip id="dig-deep">Dig Deep</Tip>
      </Pill>,
    );
  }

  if (active.length === 0 && ready.length === 0) return null;

  return (
    <div className="status-pills">
      {active.length > 0 ? (
        <>
          <span className="status-pills-label">Now</span>
          {active}
        </>
      ) : null}
      {active.length > 0 && ready.length > 0 ? (
        <span className="status-pills-sep" aria-hidden="true" />
      ) : null}
      {ready.length > 0 ? (
        <>
          <span className="status-pills-label">Ready</span>
          {ready}
        </>
      ) : null}
    </div>
  );
}

type EffectChip = { text: string; tone: "bad" | "good" };

function effectChips(e: ConditionEffects): EffectChip[] {
  if (e.dead) return [{ text: "Exhaustion 6 — Gary is dead", tone: "bad" }];
  const chips: EffectChip[] = [];
  if (e.d20Penalty === 2 * (EXHAUSTION_DEATH - 1)) {
    chips.push({ text: "1 Exhaustion from death", tone: "bad" });
  }
  if (e.cantAct.length > 0) {
    chips.push({ text: "Can’t act or react", tone: "bad" });
  }
  const atk = GARY.attack - e.d20Penalty;
  if (e.cantAct.length === 0 && (e.d20Penalty > 0 || e.attack.roll !== "normal")) {
    const mode = ROLL_SHORT[e.attack.roll];
    chips.push({
      text: `Attack ${signed(atk)}${mode ? ` ${mode}` : ""}`,
      tone: e.attack.roll === "advantage" && e.d20Penalty === 0 ? "good" : "bad",
    });
  }
  if (e.speed.value !== e.speed.base) {
    chips.push({ text: `Speed ${e.speed.value} ft`, tone: "bad" });
  }
  if (e.saves.str.autoFail.length > 0) {
    chips.push({ text: "Str/Dex saves fail", tone: "bad" });
  } else if (e.d20Penalty > 0) {
    chips.push({ text: `Saves −${e.d20Penalty}`, tone: "bad" });
  }
  if (e.checks.roll === "disadvantage") {
    chips.push({ text: "Checks Dis", tone: "bad" });
  }
  if (e.autoCritNear.length > 0) {
    chips.push({ text: "Melee hits crit you", tone: "bad" });
  } else if (e.againstNear.roll === "advantage") {
    chips.push({
      text:
        e.againstFar.roll === "advantage"
          ? "Foes have Adv"
          : "Foes within 5 ft have Adv",
      tone: "bad",
    });
  } else if (
    e.againstNear.roll === "disadvantage" &&
    e.againstFar.roll === "disadvantage"
  ) {
    chips.push({ text: "Foes have Dis", tone: "good" });
  }
  if (e.resistAll.length > 0) {
    chips.push({ text: "Resist all damage", tone: "good" });
  }
  return chips;
}

function StatusEffects({
  sheet,
  onDetails,
}: {
  sheet: Sheet;
  onDetails: () => void;
}) {
  const chips = effectChips(effectsFor(sheet));
  if (chips.length === 0) return null;
  return (
    <div className="status-effects">
      <span className="status-pills-label">Effects</span>
      {chips.map((c) => (
        <span key={c.text} className={`effect-chip ${c.tone}`}>
          {c.text}
        </span>
      ))}
      <button type="button" className="link-btn" onClick={onDetails}>
        Details
      </button>
    </div>
  );
}

/** `againstGary`: the roll belongs to an enemy, so Advantage is bad news */
function rollBadge(effect: RollEffect, againstGary = false) {
  if (effect.roll === "normal") {
    if (effect.advantage.length > 0 && effect.disadvantage.length > 0) {
      return <span className="roll-badge">Adv + Dis cancel</span>;
    }
    return null;
  }
  const good = (effect.roll === "advantage") !== againstGary;
  return (
    <span className={`roll-badge ${good ? "good" : "bad"}`}>
      {effect.roll === "advantage" ? "Advantage" : "Disadvantage"}
    </span>
  );
}

function rollReasons(effect: RollEffect) {
  const parts: string[] = [];
  if (effect.advantage.length > 0) parts.push(`Adv: ${reasonText(effect.advantage)}`);
  if (effect.disadvantage.length > 0) {
    parts.push(`Dis: ${reasonText(effect.disadvantage)}`);
  }
  return parts.join(" · ");
}

function EffectRow({
  label,
  value,
  badge,
  detail,
}: {
  label: ReactNode;
  value: ReactNode;
  badge?: ReactNode;
  detail?: string;
}) {
  return (
    <div className="effect-row">
      <div className="effect-label">{label}</div>
      <div className="effect-value">
        <span className="effect-number">{value}</span>
        {badge}
        {detail ? <div className="effect-detail">{detail}</div> : null}
      </div>
    </div>
  );
}

function ConditionEffectsCard({ sheet }: { sheet: Sheet }) {
  const e = effectsFor(sheet);
  if (!e.any) {
    return (
      <Text tone="tertiary">
        No conditions — Gary is at his normal numbers: attack {signed(GARY.attack)},
        Athletics {signed(GARY.athletics)}, speed {GARY.speed} ft, AC {GARY.ac}.
      </Text>
    );
  }

  if (e.dead) {
    return (
      <Text tone="secondary">
        Gary is dead at Exhaustion 6, so none of his numbers apply.
      </Text>
    );
  }

  const pen = e.d20Penalty;
  const penaltyNote = pen > 0 ? `Exhaustion −${pen}` : undefined;
  const joinDetail = (...parts: (string | undefined)[]) =>
    parts.filter(Boolean).join(" · ") || undefined;

  return (
    <div className="effects-list">
      <EffectRow
        label="Actions"
        value={e.cantAct.length > 0 ? "None" : "Normal"}
        badge={
          e.cantAct.length > 0 ? (
            <span className="roll-badge bad">No Action / BA / Reaction</span>
          ) : null
        }
        detail={
          e.cantAct.length > 0
            ? `${reasonText(e.cantAct)} — Moxie options and Bloodied But Unbowed are off`
            : undefined
        }
      />
      <EffectRow
        label="Your attacks"
        value={`${signed(GARY.attack - pen)} to hit`}
        badge={rollBadge(e.attack)}
        detail={joinDetail(rollReasons(e.attack), penaltyNote)}
      />
      <EffectRow
        label="Athletics"
        value={signed(GARY.athletics - pen)}
        badge={rollBadge(e.checks)}
        detail={joinDetail(
          rollReasons(e.checks),
          penaltyNote,
          e.checkAutoFail.length > 0
            ? `Auto-fail: ${reasonText(e.checkAutoFail)}`
            : undefined,
          e.checks.roll !== "normal" || pen > 0 ? "applies to all ability checks" : undefined,
        )}
      />
      <div className="effect-row">
        <div className="effect-label">Saves</div>
        <div className="effect-value">
          <div className="save-grid">
            {ABILITIES.map(({ id, label }) => {
              const s = e.saves[id];
              const fail = s.autoFail.length > 0;
              const changed = fail || pen > 0 || s.effect.roll !== "normal";
              return (
                <div
                  key={id}
                  className={`save-cell${fail ? " fail" : changed ? " changed" : ""}`}
                >
                  <span className="save-label">{label}</span>
                  <span className="save-value">
                    {fail ? "Fail" : signed(GARY.saves[id] - pen)}
                    {!fail && s.effect.roll === "disadvantage" ? " Dis" : ""}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="effect-detail">
            {joinDetail(
              e.saves.str.autoFail.length > 0
                ? `Str/Dex auto-fail: ${reasonText(e.saves.str.autoFail)}`
                : undefined,
              e.saves.dex.effect.disadvantage.length > 0
                ? `Dex Dis: ${reasonText(e.saves.dex.effect.disadvantage)}`
                : undefined,
              penaltyNote,
            ) ?? "Unchanged"}
          </div>
        </div>
      </div>
      <EffectRow
        label="Attacks vs. Gary"
        value={`AC ${GARY.ac}`}
        badge={rollBadge(e.againstNear, true)}
        detail={joinDetail(
          e.againstNear.roll !== e.againstFar.roll
            ? `Within 5 ft: ${e.againstNear.roll} · Farther: ${e.againstFar.roll}`
            : undefined,
          rollReasons(e.againstNear),
          e.autoCritNear.length > 0
            ? `Any hit from within 5 ft is a Critical Hit (${reasonText(e.autoCritNear)})`
            : undefined,
        )}
      />
      <EffectRow
        label="Speed"
        value={`${e.speed.value} ft`}
        detail={joinDetail(
          e.speed.zeroBy.length > 0 ? `0 from ${reasonText(e.speed.zeroBy)}` : undefined,
          pen > 0 ? `Exhaustion −${5 * (sheet.exhaustion ?? 0)} ft` : undefined,
          ...e.speed.notes,
        )}
      />
      <EffectRow
        label="Initiative"
        value={signed(GARY.initiative - pen)}
        badge={rollBadge(e.initiative)}
        detail={joinDetail(rollReasons(e.initiative), penaltyNote)}
      />
      {e.resistAll.length > 0 ? (
        <EffectRow
          label="Damage"
          value="Resist all"
          detail={`${reasonText(e.resistAll)} — the Hit tab halves damage automatically`}
        />
      ) : null}
      {e.notes.length > 0 ? (
        <EffectRow label="Also" value="" detail={e.notes.join(" · ")} />
      ) : null}
    </div>
  );
}

function StatusBar({
  sheet,
  setSheet,
  onEffectsDetails,
}: {
  onEffectsDetails: () => void;
  sheet: Sheet;
  setSheet: (next: Sheet | ((prev: Sheet) => Sheet)) => void;
}) {
  return (
    <Card>
      <CardBody>
        <div className="status-bar">
          <div className="status-hp">
            <div className="status-hp-value">
              {sheet.hp}
              {sheet.tempHp > 0 ? (
                <span className="status-temp">+{sheet.tempHp}</span>
              ) : null}
            </div>
            <div className="status-hp-label">/ {HP_MAX} HP</div>
            <div
              className="hp-bar"
              role="meter"
              aria-valuemin={0}
              aria-valuemax={HP_MAX}
              aria-valuenow={sheet.hp}
              aria-label="Hit points"
            >
              <div
                className="hp-bar-fill"
                style={{ width: `${Math.round((sheet.hp / HP_MAX) * 100)}%` }}
              />
            </div>
          </div>
          <div className="status-moxie">
            <div className="field-label">
              <Tip id="moxie">Moxie</Tip>
            </div>
            <Row gap={6} wrap>
              {Array.from({ length: MOXIE_MAX }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Set Moxie to ${i + 1}`}
                  className={`dot${i < sheet.moxie ? " filled" : ""}`}
                  onClick={() =>
                    setSheet((s) => ({ ...s, moxie: i + 1 }))
                  }
                />
              ))}
            </Row>
            <Text tone="tertiary">
              {sheet.moxie}/{MOXIE_MAX}
              {sheet.moxie === 0 ? " · spends locked" : ""}
            </Text>
          </div>
        </div>
        <StatusPills sheet={sheet} />
        <StatusEffects sheet={sheet} onDetails={onEffectsDetails} />
      </CardBody>
    </Card>
  );
}

function ConditionsPanel({
  sheet,
  setSheet,
}: {
  sheet: Sheet;
  setSheet: (next: Sheet | ((prev: Sheet) => Sheet)) => void;
}) {
  const conditions = sheet.conditions ?? emptyConditions();
  const exhaustion = sheet.exhaustion ?? 0;

  function toggle(id: ConditionId) {
    setSheet((s) => {
      const next = normalizeSheet(s);
      return {
        ...next,
        conditions: {
          ...next.conditions,
          [id]: !next.conditions[id],
        },
      };
    });
  }

  function clearConditions() {
    setSheet((s) => ({
      ...normalizeSheet(s),
      conditions: emptyConditions(),
      exhaustion: 0,
    }));
  }

  const active = activeConditions(sheet);

  return (
    <Stack gap={14}>
      <Text tone="secondary">
        Tap what currently applies. The numbers above update automatically.
      </Text>

      <div className="field">
        <span className="field-label">
          <Tip id="exhaustion">Exhaustion</Tip>
        </span>
        <Row gap={8} wrap>
          {Array.from({ length: 7 }, (_, level) => (
            <Button
              key={level}
              variant={exhaustion === level ? "primary" : "secondary"}
              onClick={() =>
                setSheet((s) => ({ ...normalizeSheet(s), exhaustion: level }))
              }
            >
              {level === 0
                ? "None"
                : level === EXHAUSTION_DEATH
                  ? `${level} · dead`
                  : String(level)}
            </Button>
          ))}
        </Row>
        {exhaustion > 0 ? (
          <Text tone="tertiary">
            {exhaustion >= EXHAUSTION_DEATH
              ? "Level 6: Gary dies."
              : `Level ${exhaustion}: −${2 * exhaustion} to every d20 test, −${5 * exhaustion} ft speed.${
                  exhaustion === EXHAUSTION_DEATH - 1
                    ? " One more level kills Gary — no more Dig Deep."
                    : ""
                }`}
          </Text>
        ) : null}
      </div>

      <div className="condition-grid">
        {CONDITION_DEFS.map((c) => {
          const on = Boolean(conditions[c.id]);
          return (
            <button
              key={c.id}
              type="button"
              className={`condition-chip${on ? " on" : ""}`}
              aria-pressed={on}
              onClick={() => toggle(c.id)}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {active.length > 0 ? (
        <div className="condition-notes">
          {active.map((c) => (
            <div key={c.id} className="condition-note">
              <div className="condition-note-head">
                <strong>{c.label}</strong>
                <a href={conditionHref(c.label)} target="_blank" rel="noreferrer">
                  Rules ↗
                </a>
              </div>
              <Text tone="secondary">{c.summary}</Text>
            </div>
          ))}
        </div>
      ) : null}

      <Row gap={8} wrap>
        <Button
          variant="ghost"
          disabled={active.length === 0 && exhaustion === 0}
          onClick={clearConditions}
        >
          Clear all conditions
        </Button>
      </Row>

      <details className="more-details">
        <summary>What every condition does</summary>
        <Stack gap={8}>
          <Text tone="tertiary">
            From the 2024 rules on D&D Beyond.{" "}
            <a href={RULES_GLOSSARY_URL} target="_blank" rel="noreferrer">
              Rules Glossary ↗
            </a>
          </Text>
          <div className="glossary-list">
            <details className="glossary-item">
              <summary>Exhaustion</summary>
              <p>{EXHAUSTION_SUMMARY}</p>
            </details>
          </div>
          <GlossaryList kind="condition" />
        </Stack>
      </details>
    </Stack>
  );
}

function RestPanel({
  sheet,
  setSheet,
}: {
  sheet: Sheet;
  setSheet: (next: Sheet | ((prev: Sheet) => Sheet)) => void;
}) {
  function patch(partial: Partial<Sheet>) {
    setSheet((s) => ({ ...s, ...partial }));
  }

  return (
    <Stack gap={14}>
      <Text tone="secondary">
        Toggle what’s still available, or take a rest to reset.
      </Text>
      <div className="resource-list">
        <label className="resource-row">
          <input
            type="checkbox"
            checked={sheet.bloodiedUnbowed}
            onChange={(e) => patch({ bloodiedUnbowed: e.target.checked })}
          />
          <span>
            <Tip id="bloodied-but-unbowed">Bloodied But Unbowed</Tip>{" "}
            <span className="tertiary">1 / short rest</span>
          </span>
        </label>
        <label className="resource-row">
          <input
            type="checkbox"
            checked={sheet.swagger}
            onChange={(e) => patch({ swagger: e.target.checked })}
          />
          <span>
            <Tip id="swagger-streak">Swagger Streak</Tip>{" "}
            <span className="tertiary">1 / short rest</span>
          </span>
        </label>
        <label className="resource-row">
          <input
            type="checkbox"
            checked={sheet.digDeep}
            onChange={(e) =>
              patch({
                digDeep: e.target.checked,
                digDeepActive: e.target.checked ? sheet.digDeepActive : false,
              })
            }
          />
          <span>
            <Tip id="dig-deep">Dig Deep</Tip>{" "}
            <span className="tertiary">free first use</span>
          </span>
        </label>
        <label className="resource-row">
          <input
            type="checkbox"
            checked={sheet.digDeepActive}
            disabled={!sheet.digDeep && !sheet.digDeepActive}
            onChange={(e) => patch({ digDeepActive: e.target.checked })}
          />
          <span>
            <Tip id="dig-deep">Dig Deep active</Tip>{" "}
            <span className="tertiary">resist B/P/S</span>
          </span>
        </label>
      </div>
      {!sheet.digDeep && !sheet.digDeepActive ? (
        <Stack gap={6}>
          <Row gap={8} wrap>
            <Button
              variant="secondary"
              disabled={!canDigDeepAgain(sheet.exhaustion)}
              onClick={() =>
                setSheet((s) =>
                  canDigDeepAgain(s.exhaustion)
                    ? { ...s, digDeepActive: true, exhaustion: s.exhaustion + 1 }
                    : s,
                )
              }
            >
              Dig Deep again (+1 Exhaustion)
            </Button>
          </Row>
          <Text tone="tertiary">Dig Deep {digDeepAgainNote(sheet.exhaustion)}</Text>
        </Stack>
      ) : null}
      <Row gap={8} wrap>
        <Button
          variant="secondary"
          onClick={() =>
            setSheet((s) => ({
              ...normalizeSheet(s),
              moxie: MOXIE_MAX,
              bloodiedUnbowed: true,
              swagger: true,
              digDeepActive: false,
              tempHp: 0,
            }))
          }
        >
          Short rest
        </Button>
        <Button
          variant="secondary"
          disabled={sheet.exhaustion >= EXHAUSTION_DEATH}
          onClick={() =>
            setSheet((s) => ({
              ...DEFAULT_SHEET,
              exhaustion: Math.max(0, (normalizeSheet(s).exhaustion || 0) - 1),
            }))
          }
        >
          Long rest
        </Button>
      </Row>
      <Text tone="tertiary">
        {sheet.exhaustion >= EXHAUSTION_DEATH
          ? "Gary is dead at Exhaustion 6 — no long rest. If the DM revives him, set Exhaustion on the Conds tab."
          : "Short restores Moxie, Bloodied, Swagger. Long restores HP, hit dice, and uses, clears conditions, and reduces Exhaustion by 1."}
      </Text>
    </Stack>
  );
}

type D20Spec = {
  id: string;
  label: string;
  /** Modifier after Exhaustion */
  bonus: number;
  effect: RollEffect;
  autoFail: Reason[];
  /** This check can take Swagger Streak */
  swagger: boolean;
  attack?: boolean;
};

type ShownRoll =
  | {
      kind: "d20";
      label: string;
      dice: number[];
      kept: number;
      bonus: number;
      total: number;
      mode: RollEffect["roll"];
      autoFail: string | null;
      notes: string;
      attack: boolean;
      swagger: boolean;
      swaggerDie?: number;
    }
      | {
      kind: "damage";
      dice: number[];
      bonus: number;
      total: number;
      crit: boolean;
    }
      | {
      kind: "brace";
      die: number;
      bonus: number;
      total: number;
      tempBefore: number;
      tempAfter: number;
    };

function rollDie(sides: number) {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] % sides) + 1;
}

function d20Notes(effect: RollEffect, penalty: number) {
  const parts: string[] = [];
  if (effect.advantage.length > 0 && effect.disadvantage.length > 0) {
    parts.push(
      `Adv (${reasonText(effect.advantage)}) and Dis (${reasonText(effect.disadvantage)}) cancel`,
    );
  } else if (effect.roll === "advantage") {
    parts.push(`Advantage: ${reasonText(effect.advantage)}`);
  } else if (effect.roll === "disadvantage") {
    parts.push(`Disadvantage: ${reasonText(effect.disadvantage)}`);
  }
  if (penalty > 0) parts.push(`Exhaustion −${penalty}`);
  return parts.join(" · ");
}

function rollCaption(spec: D20Spec) {
  if (spec.autoFail.length > 0) return "Auto-fail";
  const mode =
    spec.effect.roll === "advantage"
      ? " Adv"
      : spec.effect.roll === "disadvantage"
        ? " Dis"
        : "";
  return `${signed(spec.bonus)}${mode}`;
}

function RollButtons({
  specs,
  disabled,
  bare = false,
  onRoll,
}: {
  specs: D20Spec[];
  disabled?: boolean;
  bare?: boolean;
  onRoll: (spec: D20Spec) => void;
}) {
  const buttons = specs.map((spec) => {
        const caption = rollCaption(spec);
        const tone =
          spec.autoFail.length > 0 || spec.effect.roll === "disadvantage"
            ? "bad"
            : spec.effect.roll === "advantage"
              ? "good"
              : "";
        return (
          <button
            key={spec.id}
            type="button"
            className="roll-btn"
            disabled={disabled}
            onClick={() => onRoll(spec)}
          >
            <span>{spec.label}</span>
            <span className={`roll-btn-bonus${tone ? ` ${tone}` : ""}`}>
              {caption}
            </span>
          </button>
        );
  });
  if (bare) return <>{buttons}</>;
  return <div className="roll-grid">{buttons}</div>;
}

function RollPanel({
  sheet,
  setSheet,
}: {
  sheet: Sheet;
  setSheet: (next: Sheet | ((prev: Sheet) => Sheet)) => void;
}) {
  const [result, setResult] = useState<ShownRoll | null>(null);
  const effects = effectsFor(sheet);
  const penalty = effects.d20Penalty;
  const cantAct = effects.cantAct.length > 0;

  const saves: D20Spec[] = ABILITIES.map(({ id, label }) => ({
    id: `save-${id}`,
    label: `${label} save`,
    bonus: GARY.saves[id] - penalty,
    effect: effects.saves[id].effect,
    autoFail: effects.saves[id].autoFail,
    swagger: false,
  }));

  const checks: D20Spec[] = [
    ...ABILITIES.map(({ id, label }) => ({
      id: `check-${id}`,
      label: `${label} check`,
      bonus: GARY.checks[id] - penalty,
      effect: effects.checks,
      autoFail: [],
      swagger: sheet.swagger && SWAGGER_ABILITIES.has(id),
    })),
    ...GARY.skills.map((skill) => ({
      id: skill.id,
      label: skill.label,
      bonus: skill.bonus - penalty,
      effect: effects.checks,
      autoFail: [],
      swagger: sheet.swagger && SWAGGER_ABILITIES.has(skill.ability),
    })),
    {
      id: "initiative",
      label: "Initiative",
      bonus: GARY.initiative - penalty,
      effect: effects.initiative,
      autoFail: [],
      swagger: false,
    },
  ];

  const attack: D20Spec = {
    id: "attack",
    label: "Unarmed",
    bonus: GARY.attack - penalty,
    effect: effects.attack,
    autoFail: [],
    swagger: false,
    attack: true,
  };

  function rollD20(spec: D20Spec) {
    const mode = spec.autoFail.length > 0 ? "normal" : spec.effect.roll;
    const first = rollDie(20);
    const dice = mode === "normal" ? [first] : [first, rollDie(20)];
    const kept =
      mode === "advantage"
        ? Math.max(...dice)
        : mode === "disadvantage"
          ? Math.min(...dice)
          : first;
    setResult({
      kind: "d20",
      label: spec.label,
      dice,
      kept,
      bonus: spec.bonus,
      total: kept + spec.bonus,
      mode,
      autoFail:
        spec.autoFail.length > 0 ? reasonText(spec.autoFail) : null,
      notes: d20Notes(spec.effect, penalty),
      attack: Boolean(spec.attack),
      swagger: spec.swagger,
    });
  }

  function addSwagger() {
    if (!result || result.kind !== "d20" || !result.swagger || !sheet.swagger) {
      return;
    }
    const die = rollDie(10);
    setSheet((s) => ({ ...s, swagger: false }));
    setResult({
      ...result,
      total: result.total + die,
      swagger: false,
      swaggerDie: die,
    });
  }

  function rollDamage() {
    const crit =
      result?.kind === "d20" &&
      result.attack &&
      !result.autoFail &&
      result.kept === 20;
    const dice = Array.from({ length: crit ? 2 : 1 }, () =>
      rollDie(GARY.fisticuffsDie),
    );
    const bonus = GARY.fisticuffsBonus;
    setResult({
      kind: "damage",
      dice,
      bonus,
      total: dice.reduce((sum, n) => sum + n, 0) + bonus,
      crit,
    });
  }

  if (effects.dead) {
    return (
      <Text tone="secondary">
        Gary is dead at Exhaustion 6, so there’s nothing to roll.
      </Text>
    );
  }

  const attackNote = cantAct
    ? `Can’t attack: ${reasonText(effects.cantAct)}.`
    : null;

  return (
    <Stack gap={16}>
      {result ? <RollReadout result={result} onSwagger={addSwagger} /> : null}

      <div className="field">
        <span className="field-label">Saving throws</span>
        <RollButtons specs={saves} onRoll={rollD20} />
      </div>

      <div className="field">
        <span className="field-label">Checks</span>
        <RollButtons specs={checks} onRoll={rollD20} />
        {effects.checkAutoFail.length > 0 ? (
          <Text tone="tertiary">
            {reasonText(effects.checkAutoFail)} — those checks fail on their
            own, so don’t trust a roll that needed sight or hearing.
          </Text>
        ) : null}
      </div>

      <div className="field">
        <span className="field-label">Attack</span>
        <div className="roll-grid">
          <RollButtons
            bare
            specs={[attack]}
            disabled={cantAct}
            onRoll={rollD20}
          />
          <button
            type="button"
            className="roll-btn"
            disabled={cantAct}
            onClick={rollDamage}
          >
            <span>Damage</span>
            <span className="roll-btn-bonus">
              {result?.kind === "d20" &&
              result.attack &&
              result.kept === 20 &&
              !result.autoFail
                ? `2d${GARY.fisticuffsDie}+${GARY.fisticuffsBonus}`
                : `1d${GARY.fisticuffsDie}+${GARY.fisticuffsBonus}`}
            </span>
          </button>
        </div>
        {attackNote ? <Text tone="tertiary">{attackNote}</Text> : null}
        <Text tone="tertiary">
          A critical hit rolls damage twice. Any other die is the Dice button.
        </Text>
      </div>
    </Stack>
  );
}

function RollReadout({
  result,
  onSwagger,
}: {
  result: ShownRoll;
  onSwagger: () => void;
}) {
  if (result.kind === "damage") {
    return (
      <div className="roll-result">
        <div className="roll-result-label">
          {result.crit ? "Damage · critical hit" : "Damage"}
        </div>
        <div className="roll-total">{result.total}</div>
        <div className="roll-math">
          {result.dice.length}d{GARY.fisticuffsDie} {result.dice.join("+")} +{" "}
          {result.bonus} = {result.total} bludgeoning
        </div>
      </div>
    );
  }

  if (result.kind === "brace") {
    return (
      <div className="roll-result">
        <div className="roll-result-label">Brace Up</div>
        <div className="roll-total">+{result.total}</div>
        <div className="roll-math">
          d{GARY.fisticuffsDie} {result.die} + {result.bonus} = {result.total} temp
        </div>
        <div className="roll-notes">
          Temp HP {result.tempBefore} → {result.tempAfter}
        </div>
      </div>
    );
  }

  const crit = result.attack && !result.autoFail && result.kept === 20;
  const miss = result.attack && !result.autoFail && result.kept === 1;
  const dice =
    result.dice.length === 1
      ? `d20 ${result.dice[0]}`
      : `${result.dice[0]} & ${result.dice[1]} → keep ${result.kept}`;
  const math = result.autoFail
    ? `${dice} would be ${result.total}`
    : `${dice} ${signed(result.bonus)} = ${result.total}${
        result.swaggerDie ? ` · Swagger +${result.swaggerDie}` : ""
      }`;

  return (
    <div className="roll-result">
      <div className="roll-result-label">{result.label}</div>
      <div className={`roll-total${result.autoFail || miss ? " fail" : ""}`}>
        {result.autoFail ? "Fail" : miss ? "Miss" : result.total}
      </div>
      <div className="roll-math">{math}</div>
      {crit ? <div className="roll-flag good">Critical hit</div> : null}
      {miss ? <div className="roll-flag bad">Natural 1 — automatic miss</div> : null}
      {result.autoFail ? (
        <div className="roll-flag bad">Automatic failure · {result.autoFail}</div>
      ) : null}
      {result.notes ? <div className="roll-notes">{result.notes}</div> : null}
      {result.swagger ? (
        <Button variant="secondary" onClick={onSwagger}>
          Add Swagger +1d10
        </Button>
      ) : null}
    </div>
  );
}

function ActionRolls({
  dice,
  sheet,
  setSheet,
}: {
  dice: LineDie[];
  sheet: Sheet;
  setSheet: (next: Sheet | ((prev: Sheet) => Sheet)) => void;
}) {
  const [line, setLine] = useState<string | null>(null);
  const [crit, setCrit] = useState(false);
  const effects = effectsFor(sheet);
  const cantAct = effects.cantAct.length > 0;
  const attackBonus = GARY.attack - effects.d20Penalty;
  const attackMode = ROLL_SHORT[effects.attack.roll];

  function rollAttack() {
    const mode = effects.attack.roll;
    const first = rollDie(20);
    const diceRoll = mode === "normal" ? [first] : [first, rollDie(20)];
    const kept =
      mode === "advantage"
        ? Math.max(...diceRoll)
        : mode === "disadvantage"
          ? Math.min(...diceRoll)
          : first;
    const isCrit = kept === 20;
    const isMiss = kept === 1;
    setCrit(isCrit);
    const shown =
      diceRoll.length === 1
        ? `d20 ${kept}`
        : `${diceRoll[0]} & ${diceRoll[1]} → ${kept}`;
    setLine(
      isMiss
        ? `To hit ${shown} · natural 1, miss`
        : `To hit ${shown} ${signed(attackBonus)} = ${kept + attackBonus}${isCrit ? " · critical hit" : ""}`,
    );
  }

  function rollDamage() {
    const faces = crit ? 2 : 1;
    const rolled = Array.from({ length: faces }, () => rollDie(GARY.fisticuffsDie));
    const total = rolled.reduce((sum, n) => sum + n, 0) + GARY.fisticuffsBonus;
    setCrit(false);
    setLine(
      `${crit ? "Crit " : ""}${faces}d${GARY.fisticuffsDie} ${rolled.join("+")} + ${GARY.fisticuffsBonus} = ${total} bludgeoning`,
    );
  }

  function rollBrace() {
    const die = rollDie(GARY.fisticuffsDie);
    const total = die + GARY.braceBonus;
    const next = Math.max(sheet.tempHp, total);
    setSheet((s) => ({ ...s, tempHp: Math.max(s.tempHp, total) }));
    setLine(
      `Brace Up d${GARY.fisticuffsDie} ${die} + ${GARY.braceBonus} = ${total} temp${
        next === sheet.tempHp ? ` · kept ${sheet.tempHp}` : ` · temp ${sheet.tempHp} → ${next}`
      }`,
    );
  }

  function rollSwagger() {
    if (!sheet.swagger) return;
    const die = rollDie(10);
    setSheet((s) => ({ ...s, swagger: false }));
    setLine(`Swagger +${die}`);
  }

  return (
    <Stack gap={6}>
      <Row gap={8} wrap>
        {dice.includes("attack") ? (
          <button
            type="button"
            className="roll-btn compact"
            disabled={cantAct}
            onClick={rollAttack}
          >
            To hit {signed(attackBonus)}
            {attackMode ? ` ${attackMode}` : ""}
          </button>
        ) : null}
        {dice.includes("damage") ? (
          <button
            type="button"
            className="roll-btn compact"
            disabled={cantAct}
            onClick={rollDamage}
          >
            {crit
              ? `Crit 2d${GARY.fisticuffsDie}+${GARY.fisticuffsBonus}`
              : `Damage 1d${GARY.fisticuffsDie}+${GARY.fisticuffsBonus}`}
          </button>
        ) : null}
        {dice.includes("brace") ? (
          <button type="button" className="roll-btn compact" onClick={rollBrace}>
            Brace Up 1d{GARY.fisticuffsDie}+{GARY.braceBonus}
          </button>
        ) : null}
        {dice.includes("swagger") ? (
          <button
            type="button"
            className="roll-btn compact"
            disabled={!sheet.swagger}
            onClick={rollSwagger}
          >
            {sheet.swagger ? "Swagger +1d10" : "Swagger used"}
          </button>
        ) : null}
      </Row>
      {line ? <div className="line-roll">{line}</div> : null}
    </Stack>
  );
}

function planSections(plan: Plan) {
  const sections: { heading: string; text: string; dice: LineDie[] }[] = [
    { heading: "Action", text: plan.action, dice: lineDice(plan.action) },
    { heading: "Bonus Action", text: plan.bonus, dice: lineDice(plan.bonus) },
  ];
  if (plan.reaction) {
    sections.push({
      heading: "Reaction",
      text: plan.reaction,
      dice: lineDice(plan.reaction),
    });
  }
  return sections;
}

const DICE_SIDES = [4, 6, 8, 10, 12, 20, 100] as const;

type DiceLogEntry = {
  id: number;
  sides: number;
  count: number;
  faces: number[];
  total: number;
};

function DiceRoller() {
  const [open, setOpen] = useState(false);
  const [sides, setSides] = useState<(typeof DICE_SIDES)[number]>(20);
  const [count, setCount] = useState(1);
  const [log, setLog] = useState<DiceLogEntry[]>([]);
  const latest = log[0];

  useEffect(() => {
    if (!open) return;
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function roll() {
    const faces = Array.from({ length: count }, () => rollDie(sides));
    setLog((prev) =>
      [
        {
          id: Date.now(),
          sides,
          count,
          faces,
          total: faces.reduce((sum, face) => sum + face, 0),
        },
        ...prev,
      ].slice(0, 12),
    );
  }

  return createPortal(
    <div className="dice-dock">
      {open ? (
        <div className="dice-panel" role="dialog" aria-label="Dice">
          <div className="dice-sizes">
            {DICE_SIDES.map((n) => (
              <button
                key={n}
                type="button"
                className={sides === n ? "on" : ""}
                aria-pressed={sides === n}
                onClick={() => setSides(n)}
              >
                d{n}
              </button>
            ))}
          </div>
          <div className="dice-count">
            <button
              type="button"
              aria-label="Fewer dice"
              onClick={() => setCount((n) => Math.max(1, n - 1))}
            >
              −
            </button>
            <span>{count}</span>
            <button
              type="button"
              aria-label="More dice"
              onClick={() => setCount((n) => Math.min(20, n + 1))}
            >
              +
            </button>
          </div>
          <button type="button" className="dice-roll" onClick={roll}>
            Roll {count}d{sides}
          </button>
          {latest ? (
            <div className="dice-latest">
              <div className="dice-latest-total">{latest.total}</div>
              <div className="dice-latest-detail">
                {latest.count}d{latest.sides}
                {latest.faces.length > 1 ? ` · ${latest.faces.join(" + ")}` : ""}
              </div>
            </div>
          ) : (
            <p className="dice-latest-detail">Pick a die and roll.</p>
          )}
          {log.length > 1 ? (
            <ol className="dice-log">
              {log.slice(1).map((entry) => (
                <li key={entry.id}>
                  <span>
                    {entry.count}d{entry.sides}
                  </span>
                  <span>{entry.total}</span>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}
      <button
        type="button"
        className="dice-fab"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Dice
      </button>
    </div>,
    document.body,
  );
}

type MainTab = "play" | "hit" | "roll" | "conds" | "rest";

export function GaryCombatTool() {
  const [phase, setPhase] = useState<Phase>("timing");
  const [timing, setTiming] = useState<Timing | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [staticPlan, setStaticPlan] = useState<Plan | null>(null);
  const [sheetRaw, setSheetRaw] = usePersistentState<Sheet>(
    "gary-grapplesauce-combat:sheet",
    DEFAULT_SHEET,
  );
  const sheet = useMemo(() => normalizeSheet(sheetRaw), [sheetRaw]);
  const setSheet = useCallback<typeof setSheetRaw>(
    (next) => {
      if (typeof next === "function") {
        setSheetRaw((prev) => normalizeSheet(next(normalizeSheet(prev))));
      } else {
        setSheetRaw(normalizeSheet(next));
      }
    },
    [setSheetRaw],
  );
  const [tab, setTab] = usePersistentState<MainTab>(
    "gary-grapplesauce-combat:tab",
    "play",
  );
  const [spentApplied, setSpentApplied] = useState(false);

  // Migrate old moxie-only key once
  useEffect(() => {
    try {
      const legacy = localStorage.getItem(
        "table-tools:gary-grapplesauce-combat:moxie",
      );
      const hasSheet = localStorage.getItem(
        "table-tools:gary-grapplesauce-combat:sheet",
      );
      if (legacy != null && hasSheet == null) {
        const moxie = clamp(JSON.parse(legacy) as number, 0, MOXIE_MAX);
        setSheet((s) => ({ ...s, moxie }));
        localStorage.removeItem("table-tools:gary-grapplesauce-combat:moxie");
      }
    } catch {
      // ignore
    }
  }, [setSheet]);

  const availableGoals = GOAL_OPTIONS.filter((g) => g.cost <= sheet.moxie);
  const hiddenGoals = GOAL_OPTIONS.filter((g) => g.cost > sheet.moxie);

  const liveGoalPlan = useMemo(() => {
    if (!selectedGoal) return null;
    const option = GOAL_OPTIONS.find((g) => g.id === selectedGoal);
    if (!option || option.cost > sheet.moxie) return null;
    return planFor(selectedGoal, sheet);
  }, [selectedGoal, sheet]);

  const plan = selectedGoal ? liveGoalPlan : staticPlan;

  useEffect(() => {
    if (!selectedGoal || phase !== "result") return;
    const option = GOAL_OPTIONS.find((g) => g.id === selectedGoal);
    if (!option || option.cost > sheet.moxie) {
      setSelectedGoal(null);
      setSpentApplied(false);
      setPhase("goal");
    }
  }, [sheet.moxie, selectedGoal, phase]);

  useEffect(() => {
    setSpentApplied(false);
  }, [liveGoalPlan?.title, liveGoalPlan?.costLabel, staticPlan?.title]);

  function resetDecision() {
    setPhase("timing");
    setTiming(null);
    setSelectedGoal(null);
    setStaticPlan(null);
    setSpentApplied(false);
  }

  function pickTiming(next: Timing) {
    setTiming(next);
    setSelectedGoal(null);
    setStaticPlan(null);
    setSpentApplied(false);
    if (next === "check-fail") {
      setStaticPlan(checkFailPlan(sheet.swagger));
      setPhase("result");
      return;
    }
    if (next === "reaction") {
      setPhase("reaction");
      return;
    }
    setPhase("goal");
  }

  function pickReaction(kind: ReactionKind) {
    setSelectedGoal(null);
    setStaticPlan(reactionPlan(kind));
    setSpentApplied(false);
    setPhase("result");
  }

  function pickGoal(goal: Goal) {
    const option = GOAL_OPTIONS.find((g) => g.id === goal);
    if (!option || option.cost > sheet.moxie) return;
    setStaticPlan(null);
    setSelectedGoal(goal);
    setSpentApplied(false);
    setPhase("result");
  }

  function applyPlan() {
    if (!plan || spentApplied || !plan.apply || plan.apply === "none") return;

    setSheet((s) => {
      switch (plan.apply) {
        case "moxie":
          return {
            ...s,
            moxie: clamp(s.moxie - plan.cost, 0, MOXIE_MAX),
          };
        case "bloodied-unbowed":
          return {
            ...s,
            moxie: MOXIE_MAX,
            bloodiedUnbowed: false,
            tempHp: Math.max(s.tempHp, 36),
          };
        case "dig-deep":
          return {
            ...s,
            digDeep: false,
            digDeepActive: true,
          };
        case "dig-deep-exhaustion":
          if (!canDigDeepAgain(s.exhaustion)) return s;
          return {
            ...s,
            digDeepActive: true,
            exhaustion: s.exhaustion + 1,
          };
        case "swagger":
          return { ...s, swagger: false };
        default:
          return s;
      }
    });
    setSpentApplied(true);
  }

  function applyLabel(p: Plan): string | null {
    if (!p.apply || p.apply === "none") return null;
    if (spentApplied) {
      switch (p.apply) {
        case "moxie":
          return `Spent ${p.cost} Moxie`;
        case "bloodied-unbowed":
          return "Applied — Moxie full + 36 temp";
        case "dig-deep":
          return "Dig Deep used";
        case "dig-deep-exhaustion":
          return "Dig Deep used · +1 Exhaustion";
        case "swagger":
          return "Swagger used";
        default:
          return "Applied";
      }
    }
    switch (p.apply) {
      case "moxie":
        return `Spend ${p.cost} Moxie`;
      case "bloodied-unbowed":
        return "Apply Bloodied But Unbowed";
      case "dig-deep":
        return "Use Dig Deep";
      case "dig-deep-exhaustion":
        return "Dig Deep (+1 Exhaustion)";
      case "swagger":
        return "Use Swagger Streak";
      default:
        return null;
    }
  }

  const effects = effectsFor(sheet);
  const cantAct = effects.cantAct.length > 0;
  const canBloodiedReaction =
    sheet.bloodiedUnbowed && isBloodied(sheet.hp) && !cantAct;
  const bloodiedBlockedReason = cantAct
    ? `Can’t take Reactions (${reasonText(effects.cantAct)})`
    : !sheet.bloodiedUnbowed
      ? "Already used this short rest"
      : !isBloodied(sheet.hp)
        ? `Not bloodied (need HP ≤ ${BLOODIED_AT})`
        : null;
  const penalty = effects.d20Penalty;
  const attackMode = ROLL_SHORT[effects.attack.roll];

  return (
    <Stack gap={16}>
      <Stack gap={4}>
        <h1>Gary Grapplesauce</h1>
        <Text tone="secondary">
          {effects.dead
            ? "Dead · Exhaustion 6"
            : [
                cantAct
                  ? "Can’t act"
                  : `${signed(GARY.attack - penalty)}${attackMode ? ` (${attackMode})` : ""} / ${GARY.damage}`,
                `AC ${GARY.ac}`,
                `Athletics ${signed(GARY.athletics - penalty)}`,
                effects.speed.value !== GARY.speed
                  ? `Speed ${effects.speed.value} ft`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
        </Text>
      </Stack>

      <StatusBar
        sheet={sheet}
        setSheet={setSheet}
        onEffectsDetails={() => setTab("conds")}
      />

      {effects.dead || (tab === "play" && cantAct) ? (
        <Callout
          title={effects.dead ? "Gary is dead — Exhaustion 6" : "Gary can’t act"}
          tone="warning"
        >
          {effects.dead
            ? "Exhaustion 6 is instant death (no death saves). The decision tree is off. If the DM revives him, lower Exhaustion on the Conds tab."
            : `${reasonText(effects.cantAct)}: no Action, Bonus Action, or Reaction — Moxie options are off until this ends.`}
        </Callout>
      ) : effects.d20Penalty === 2 * (EXHAUSTION_DEATH - 1) && tab === "play" ? (
        <Callout title="Exhaustion 5 — one level from death" tone="warning">
          Don’t Dig Deep again or take anything else that adds Exhaustion. A
          long rest drops it to 4.
        </Callout>
      ) : null}

      <div className="tab-bar" role="tablist" aria-label="Main mode">
        {(
          [
            ["play", "Play"],
            ["hit", "Hit"],
            ["roll", "Roll"],
            ["conds", "Conds"],
            ["rest", "Rest"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`tab-btn${tab === id ? " active" : ""}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "play" ? (
        <Stack gap={12}>
          {!effects.dead && phase === "timing" && (
            <Card>
              <CardHeader>What just happened?</CardHeader>
              <CardBody>
                <Stack gap={12}>
                  <Row gap={8} wrap>
                    <Button variant="primary" onClick={() => pickTiming("turn")}>
                      My turn
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => pickTiming("reaction")}
                    >
                      Reaction
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => pickTiming("check-fail")}
                    >
                      Failed check
                    </Button>
                  </Row>
                </Stack>
              </CardBody>
            </Card>
          )}

          {!effects.dead && phase === "reaction" && (
            <Card>
              <CardHeader>Reaction</CardHeader>
              <CardBody>
                <Stack gap={12}>
                  <Row gap={8} wrap>
                    <Button
                      variant="primary"
                      disabled={!canBloodiedReaction}
                      onClick={() => pickReaction("bloodied")}
                    >
                      Bloodied + damage
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => pickReaction("mage-cast")}
                    >
                      Spell within 5 ft
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => pickReaction("opportunity")}
                    >
                      Left my reach
                    </Button>
                    <Button variant="ghost" onClick={() => pickReaction("other")}>
                      Hold reaction
                    </Button>
                  </Row>
                  {bloodiedBlockedReason ? (
                    <Text tone="tertiary">
                      Bloodied locked: {bloodiedBlockedReason}
                    </Text>
                  ) : null}
                  <Button variant="ghost" onClick={resetDecision}>
                    Back
                  </Button>
                </Stack>
              </CardBody>
            </Card>
          )}

          {!effects.dead && phase === "goal" && (
            <Card>
              <CardHeader>This turn</CardHeader>
              <CardBody>
                <Stack gap={12}>
                  <Row gap={8} wrap>
                    {availableGoals.map((g) => (
                      <Button
                        key={g.id}
                        variant={g.variant}
                        onClick={() => pickGoal(g.id)}
                      >
                        {g.cost > 0 ? `${g.label} · ${g.cost}` : g.label}
                      </Button>
                    ))}
                  </Row>
                  {hiddenGoals.length > 0 ? (
                    <Text tone="tertiary">
                      Need more Moxie:{" "}
                      {hiddenGoals.map((g) => g.label).join(", ")}
                    </Text>
                  ) : null}
                  <Button variant="ghost" onClick={resetDecision}>
                    Back
                  </Button>
                </Stack>
              </CardBody>
            </Card>
          )}

          {!effects.dead && phase === "result" && plan && (
            <Card>
              <CardHeader trailing={<Pill>{plan.costLabel}</Pill>}>
                {plan.title}
              </CardHeader>
              <CardBody>
                <Stack gap={14}>
                  {planSections(plan).map((section, index) => (
                    <Stack key={section.heading} gap={6}>
                      {index > 0 ? <Divider /> : null}
                      <h3>{section.heading}</h3>
                      <Text>{section.text}</Text>
                      {section.dice.length > 0 ? (
                        <ActionRolls
                          dice={section.dice}
                          sheet={sheet}
                          setSheet={setSheet}
                        />
                      ) : null}
                    </Stack>
                  ))}
                  <Text tone="secondary">{plan.gym}</Text>
                  <PlanTips plan={plan} />
                  <Row gap={8} wrap>
                    {applyLabel(plan) ? (
                      <Button
                        variant="primary"
                        disabled={
                          spentApplied ||
                          (plan.apply === "moxie" && sheet.moxie < plan.cost)
                        }
                        onClick={applyPlan}
                      >
                        {applyLabel(plan)}
                      </Button>
                    ) : null}
                    {selectedGoal === "survive" &&
                    sheet.digDeep &&
                    plan.apply === "moxie" ? (
                      <Button
                        variant="secondary"
                        disabled={spentApplied}
                        onClick={() => {
                          setSheet((s) => ({
                            ...s,
                            digDeep: false,
                            digDeepActive: true,
                          }));
                        }}
                      >
                        Also Dig Deep
                      </Button>
                    ) : null}
                    <Button variant="secondary" onClick={resetDecision}>
                      New decision
                    </Button>
                    {timing === "turn" ? (
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setSelectedGoal(null);
                          setStaticPlan(null);
                          setSpentApplied(false);
                          setPhase("goal");
                        }}
                      >
                        Change goal
                      </Button>
                    ) : null}
                  </Row>
                </Stack>
              </CardBody>
            </Card>
          )}

          <details className="more-details">
            <summary>Priority cheat sheet</summary>
            <Stack gap={8}>
              {[
                "1. Bloodied But Unbowed if eligible.",
                "2. Mage Slayer if they cast within 5 ft.",
                "3. Live? Brace Up or Dig Deep.",
                "4. Move? Stick and Move.",
                "5. Else: Attack → Heavy Hitter → free punch.",
                "6. Lockdown: Stop and Drop → Compression Lock.",
                "7. Burst with One-Two when Moxie allows.",
              ].map((line) => (
                <div key={line} className="cheat-line">
                  <Text>{line}</Text>
                </div>
              ))}
            </Stack>
          </details>

          <details className="more-details">
            <summary>Rules glossary (Pugilist)</summary>
            <Stack gap={8}>
              <Text tone="tertiary">
                Summaries from the Sterling Vermin Pugilist 2024 write-up, with
                Gary’s level-9 numbers where useful. Tap any ? in the UI for the
                same blurbs.{" "}
                <a href={PUGILIST_POST_URL} target="_blank" rel="noreferrer">
                  Pugilist on D&D Beyond ↗
                </a>
              </Text>
              <GlossaryList />
            </Stack>
          </details>
        </Stack>
      ) : null}

      {tab === "hit" ? (
        <Card>
          <CardHeader>I took a hit</CardHeader>
          <CardBody>
            <DamageAdjuster sheet={sheet} setSheet={setSheet} />
          </CardBody>
        </Card>
      ) : null}

      {tab === "roll" ? (
        <Card>
          <CardHeader>Roll</CardHeader>
          <CardBody>
            <RollPanel sheet={sheet} setSheet={setSheet} />
          </CardBody>
        </Card>
      ) : null}

      {tab === "conds" ? (
        <Stack gap={12}>
          <Card>
            <CardHeader>Effects on Gary right now</CardHeader>
            <CardBody>
              <ConditionEffectsCard sheet={sheet} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader>Conditions</CardHeader>
            <CardBody>
              <ConditionsPanel sheet={sheet} setSheet={setSheet} />
            </CardBody>
          </Card>
        </Stack>
      ) : null}

      {tab === "rest" ? (
        <Card>
          <CardHeader>Rests & limited uses</CardHeader>
          <CardBody>
            <RestPanel sheet={sheet} setSheet={setSheet} />
          </CardBody>
        </Card>
      ) : null}

      <DiceRoller />

      <footer className="tool-sources">
        <span>Rules:</span>
        <a href={PUGILIST_POST_URL} target="_blank" rel="noreferrer">
          Pugilist class on D&D Beyond ↗
        </a>
        <a href={RULES_GLOSSARY_URL} target="_blank" rel="noreferrer">
          Conditions (2024 Rules Glossary) ↗
        </a>
      </footer>
    </Stack>
  );
}
