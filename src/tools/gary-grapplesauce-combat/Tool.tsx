import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  ArrowLeft,
  Ban,
  BatteryLow,
  BicepsFlexed,
  BookOpen,
  Brain,
  Calculator,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  Circle,
  CircleCheck,
  CircleDot,
  CircleHelp,
  Coffee,
  Compass,
  Dices,
  Droplet,
  Eraser,
  ExternalLink,
  Eye,
  EyeOff,
  Flame,
  Footprints,
  Grab,
  Hand,
  Hash,
  Heart,
  HeartCrack,
  HeartPulse,
  History,
  Hourglass,
  Info,
  Lightbulb,
  ListOrdered,
  Lock,
  Minus,
  Moon,
  Pickaxe,
  Plus,
  Repeat,
  RotateCcw,
  Save,
  ScrollText,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldHalf,
  ShieldOff,
  ShieldPlus,
  Skull,
  SlidersHorizontal,
  Sparkles,
  Star,
  Sword,
  Swords,
  Target,
  Tent,
  Trash2,
  TriangleAlert,
  WandSparkles,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { usePersistentState } from "../../lib/usePersistentState";
import {
  Accordion,
  Button,
  Callout,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Drawer,
  Pill,
  Row,
  Stack,
  Stat,
  Text,
} from "../../ui";
import { cx } from "../../lib/cx";
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
import { GlossaryItem, GlossaryList, Tip } from "./Tip";
import {
  ROLL_LOG_MAX,
  RollLogContext,
  rollId,
  useRollLog,
  type NewRoll,
  type RollLogApi,
  type RollLogEntry,
} from "./rollLog";

const FIELD_INPUT =
  "w-full appearance-none rounded-lg border border-line bg-well px-3 py-2.5 text-ink outline-none transition-colors focus:border-gold/70";

function FieldLabel({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-muted">
      <Icon className="size-3.5 text-gold/80" aria-hidden />
      {children}
    </span>
  );
}

function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cx(FIELD_INPUT, "pr-9", className)} {...props} />
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-faint"
        aria-hidden
      />
    </div>
  );
}

const RESOURCE_ROW =
  "flex min-h-12 cursor-pointer items-center gap-2.5 rounded-lg border border-line bg-well/60 px-3 py-2 transition-colors has-[:checked]:border-gold/50 has-[:checked]:bg-gold/[0.06]";
const CHECKBOX = "size-4 shrink-0 accent-gold";
const RESOURCE_ICON = "size-4 shrink-0 text-gold/80";
const RESOURCE_NOTE = "block text-xs text-faint";

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
            "Dig Deep (1/long rest): resistance to nonmagical B/P/S for 10 minutes. Brace Up locked (no Moxie).",
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
          bonus: `Dig Deep again by taking 1 Exhaustion (${sheet.exhaustion} → ${next}): resistance to nonmagical B/P/S.`,
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
  magical?: boolean;
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

/** Dig Deep only covers nonmagical B/P/S at this table; Petrified covers everything. */
function autoResistReason(
  sheet: Sheet,
  type: DamageType,
  magical: boolean,
): string | null {
  if (sheet.conditions.petrified) return "Petrified";
  if (sheet.digDeepActive && isWeaponPhysical(type) && !magical) {
    return "Dig Deep";
  }
  return null;
}

function resolveEffectiveness(
  type: DamageType,
  sheet: Sheet,
  mode: Effectiveness,
  magical: boolean,
): Exclude<Effectiveness, "auto"> {
  if (mode !== "auto") return mode;
  return autoResistReason(sheet, type, magical) ? "resistant" : "normal";
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

const OUTCOME_SLOT = "min-h-[6.5rem]";

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
  const physical = isWeaponPhysical(ui.type);
  const magical = physical && ui.magical === true;
  const typeLabel = magical ? `magical ${ui.type}` : ui.type;
  const resolved = resolveEffectiveness(
    ui.type,
    sheet,
    ui.effectiveness,
    magical,
  );
  const autoReason = autoResistReason(sheet, ui.type, magical);
  const digDeepBypassed =
    magical && sheet.digDeepActive && ui.effectiveness === "auto";
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
      `${raw} ${typeLabel}`,
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
    } else if (digDeepBypassed) {
      bits.push("magical, so Dig Deep didn’t resist");
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
        : digDeepBypassed
          ? "magical, Dig Deep skipped"
          : "Normal"
      : ui.effectiveness;

  return (
    <Stack gap={14}>
      <Text tone="secondary">
        Type the total, pick the type, then Take damage. Enter applies.
      </Text>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <FieldLabel icon={Hash}>Amount</FieldLabel>
          <input
            className={cx(FIELD_INPUT, "text-2xl font-semibold tabular-nums")}
            inputMode="numeric"
            pattern="[0-9]*"
            value={ui.amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={onAmountKeyDown}
            aria-label="Damage or heal amount"
            autoFocus
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <FieldLabel icon={Flame}>Type</FieldLabel>
          <Select
            className="min-h-[3.25rem] capitalize"
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
          </Select>
        </label>
      </div>

      <button
        type="button"
        aria-pressed={magical}
        disabled={!physical}
        onClick={() => setUi((u) => ({ ...u, magical: !u.magical }))}
        className={cx(
          "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border px-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          magical
            ? "border-gold/70 bg-gold/10 text-gold-soft"
            : "border-line bg-well/60 text-ink hover:border-gold/50",
        )}
      >
        {magical ? (
          <CircleCheck className="size-4 shrink-0" aria-hidden />
        ) : (
          <Circle className="size-4 shrink-0 text-faint" aria-hidden />
        )}
        <WandSparkles
          className={cx("size-4 shrink-0", magical ? "text-gold" : "text-gold/70")}
          aria-hidden
        />
        <span className="flex-1 text-sm font-medium">Magical</span>
        <span className="text-xs text-faint">
          {physical ? "skips Dig Deep" : "B/P/S only"}
        </span>
      </button>

      <div className="flex min-h-14 items-center gap-2 rounded-lg border border-line bg-well/60 px-3 py-2 text-sm text-muted tabular-nums">
        <Calculator className="size-4 shrink-0 text-gold/80" aria-hidden />
        <span>
          {raw} → <strong className="text-ink">{preview}</strong> {typeLabel} ({effHint})
          {sheet.tempHp > 0 ? ` · temp ${sheet.tempHp} first` : ""}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="danger" icon={HeartCrack} onClick={takeDamage}>
          Take damage
        </Button>
        <Button variant="secondary" icon={HeartPulse} onClick={heal}>
          Heal
        </Button>
      </div>

      {outcome ? (
        <Callout
          key={`${outcome.title}${outcome.detail}`}
          tone={outcome.tone}
          title={outcome.title}
          icon={outcome.tone === "warning" ? TriangleAlert : CircleCheck}
          className={cx(OUTCOME_SLOT, "animate-pop-in")}
        >
          {outcome.detail}
        </Callout>
      ) : (
        <div
          className={cx(
            OUTCOME_SLOT,
            "flex items-center gap-3 rounded-xl border border-dashed border-line px-3.5 text-sm text-faint",
          )}
        >
          <CircleCheck className="size-5 shrink-0" aria-hidden />
          What happened to Gary’s HP shows here.
        </div>
      )}

      <Accordion title="More damage options" icon={SlidersHorizontal}>
        <Stack gap={12}>
          <label className="flex flex-col gap-1.5">
            <FieldLabel icon={ShieldHalf}>Override vs Gary</FieldLabel>
            <Select
              value={ui.effectiveness}
              onChange={(e) =>
                setUi((u) => ({
                  ...u,
                  effectiveness: e.target.value as Effectiveness,
                }))
              }
            >
              <option value="auto">Auto (Dig Deep if nonmagical B/P/S)</option>
              <option value="normal">Normal</option>
              <option value="resistant">Resistant (½)</option>
              <option value="immune">Immune (0)</option>
              <option value="vulnerable">Vulnerable (×2)</option>
            </Select>
          </label>

          <Row gap={6} wrap>
            {ui.increments.map((n) => (
              <Button
                key={n}
                size="sm"
                variant="secondary"
                icon={Plus}
                className="tabular-nums"
                onClick={() => bump(n)}
              >
                {n}
              </Button>
            ))}
          </Row>
          <Row gap={6} wrap>
            {ui.increments.map((n) => (
              <Button
                key={`m${n}`}
                size="sm"
                variant="ghost"
                icon={Minus}
                className="tabular-nums"
                onClick={() => bump(-n)}
              >
                {n}
              </Button>
            ))}
          </Row>

          <Row gap={6} wrap align="center">
            <input
              className={cx(FIELD_INPUT, "w-18 py-2 tabular-nums")}
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
              size="sm"
              variant="ghost"
              icon={Plus}
              onClick={() =>
                bump(Number.parseInt(ui.customIncrement || "0", 10) || 0)
              }
            >
              step
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={Minus}
              onClick={() =>
                bump(-(Number.parseInt(ui.customIncrement || "0", 10) || 0))
              }
            >
              step
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={Save}
              onClick={addIncrementPreset}
            >
              Save step
            </Button>
          </Row>

          <Divider />

          <Row gap={6} wrap>
            <span className="inline-flex items-center gap-1.5 pr-1 text-sm text-muted tabular-nums">
              <Shield className="size-4 text-gold/80" aria-hidden />
              Temp HP: {sheet.tempHp}
            </span>
            <Button
              size="sm"
              variant="ghost"
              icon={ShieldPlus}
              onClick={() =>
                setSheet((s) => ({ ...s, tempHp: s.tempHp + raw }))
              }
            >
              Add amount as temp
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={ShieldOff}
              disabled={sheet.tempHp <= 0}
              onClick={() => setSheet((s) => ({ ...s, tempHp: 0 }))}
            >
              Clear temp
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={Heart}
              onClick={() =>
                setSheet((s) => ({ ...s, hp: HP_MAX, tempHp: 0 }))
              }
            >
              Full HP
            </Button>
          </Row>
        </Stack>
      </Accordion>
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
      <span className="inline-flex items-center gap-1 text-[0.85rem] text-faint">
        <Lightbulb className="size-3.5 text-gold/80" aria-hidden />
        Tips:
      </span>
      {unique.map((id) => (
        <Tip key={id} id={id}>
          {GLOSSARY[id].label}
        </Tip>
      ))}
    </Row>
  );
}

const TONE_CHIP = {
  bad: "border-crimson/40 bg-crimson/15 text-crimson-soft",
  good: "border-verdant/30 bg-verdant/10 text-verdant",
  neutral: "border-line bg-well/70 text-muted",
} as const;

const CHIP =
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[0.75rem] leading-snug";

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
          : "Foes in 5 ft have Adv",
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

type ReadyState = "ready" | "used" | "on";

const READY_TILE: Record<ReadyState, string> = {
  ready: "border-verdant/35 bg-verdant/[0.08] text-ink",
  on: "border-gold/70 bg-gold/15 text-gold-soft",
  used: "border-line bg-well/50 text-faint",
};

const READY_WORD: Record<ReadyState, string> = {
  ready: "ready",
  on: "on now",
  used: "used",
};

function ReadyTile({
  state,
  tip,
  children,
}: {
  state: ReadyState;
  tip: keyof typeof GLOSSARY;
  children: ReactNode;
}) {
  const Icon = state === "used" ? Circle : state === "on" ? ShieldCheck : CircleCheck;
  return (
    <div
      className={cx(
        "flex h-8 min-w-0 items-center gap-1.5 rounded-lg border px-2 text-[0.78rem] font-medium transition-colors",
        READY_TILE[state],
      )}
    >
      <Icon
        className={cx(
          "size-3.5 shrink-0",
          state === "ready" && "text-verdant",
          state === "on" && "text-gold",
        )}
        aria-hidden
      />
      <span className={cx("min-w-0 flex-1", state === "used" && "line-through decoration-faint/60")}>
        <Tip id={tip} fill icon={false}>
          {children}
          <span className="sr-only"> ({READY_WORD[state]})</span>
        </Tip>
      </span>
    </div>
  );
}

const STATUS_LABEL =
  "inline-flex items-center gap-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-faint";

/** Equal-width chip slot; fixed height so a grid of them never reflows. */
const SLOT_CHIP =
  "flex h-6 min-w-0 animate-pop-in items-center rounded-full border px-2 text-[0.75rem] leading-none";

const NOW_CHIP = {
  bad: cx(SLOT_CHIP, TONE_CHIP.bad),
  active: cx(SLOT_CHIP, "border-gold/55 bg-gold/10 text-gold-soft"),
};

function StatusSection({
  icon: Icon,
  label,
  trailing,
  children,
}: {
  icon: LucideIcon;
  label: string;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-1" aria-label={label}>
      <div className="flex h-5 items-center justify-between gap-2">
        <span className={STATUS_LABEL}>
          <Icon className="size-3 text-gold/70" aria-hidden />
          {label}
        </span>
        {trailing}
      </div>
      {children}
    </section>
  );
}

/**
 * Two fixed rows of equal slots. New chips fill empty slots instead of
 * pushing content down; past the last slot, a "+N more" chip opens details.
 */
function SlotGrid({
  items,
  columns,
  empty,
  onMore,
}: {
  items: ReactNode[];
  columns: 2 | 3;
  empty: string;
  onMore: () => void;
}) {
  const slots = columns * 2;
  const overflow = items.length > slots;
  const shown = overflow ? items.slice(0, slots - 1) : items;
  return (
    <div
      className={cx(
        "grid h-[3.25rem] content-start gap-1",
        columns === 3 ? "grid-cols-3" : "grid-cols-2",
      )}
    >
      {items.length === 0 ? (
        <span className="col-span-full flex h-6 items-center text-xs text-faint">
          {empty}
        </span>
      ) : null}
      {shown}
      {overflow ? (
        <button
          type="button"
          className={cx(
            SLOT_CHIP,
            "cursor-pointer justify-center border-gold/40 bg-gold/10 font-semibold text-gold-soft hover:bg-gold/20",
          )}
          onClick={onMore}
        >
          +{items.length - shown.length} more
        </button>
      ) : null}
    </div>
  );
}

function StatusPanels({
  sheet,
  onDetails,
}: {
  sheet: Sheet;
  onDetails: () => void;
}) {
  const now: ReactNode[] = [];
  if (isBloodied(sheet.hp)) {
    now.push(
      <span key="bloodied" className={NOW_CHIP.bad}>
        <Tip id="bloodied" fill>
          Bloodied
        </Tip>
      </span>,
    );
  }
  if ((sheet.exhaustion ?? 0) > 0) {
    now.push(
      <span key="exhaustion" className={NOW_CHIP.bad}>
        <Tip id="exhaustion" fill>
          Exhaustion {sheet.exhaustion}
        </Tip>
      </span>,
    );
  }
  for (const c of activeConditions(sheet)) {
    now.push(
      <span key={c.id} className={NOW_CHIP.active}>
        <Tip id={`cond-${c.id}`} fill>
          {c.label}
        </Tip>
      </span>,
    );
  }

  const effects = effectChips(effectsFor(sheet)).map((c) => (
    <span
      key={c.text}
      className={cx(SLOT_CHIP, TONE_CHIP[c.tone])}
      title={c.text}
    >
      <span className="min-w-0 truncate">{c.text}</span>
    </span>
  ));

  const digDeep: ReadyState = sheet.digDeepActive
    ? "on"
    : sheet.digDeep
      ? "ready"
      : "used";

  return (
    <>
      <StatusSection icon={Sparkles} label="Ready">
        <div className="grid grid-cols-3 gap-1">
          <ReadyTile
            state={sheet.bloodiedUnbowed ? "ready" : "used"}
            tip="bloodied-but-unbowed"
          >
            Unbowed
          </ReadyTile>
          <ReadyTile
            state={sheet.swagger ? "ready" : "used"}
            tip="swagger-streak"
          >
            Swagger
          </ReadyTile>
          <ReadyTile state={digDeep} tip="dig-deep">
            Dig Deep
          </ReadyTile>
        </div>
      </StatusSection>
      <StatusSection icon={CircleDot} label="Now">
        <SlotGrid
          items={now}
          columns={3}
          empty="Nothing active"
          onMore={onDetails}
        />
      </StatusSection>
      <StatusSection
        icon={Activity}
        label="Effects"
        trailing={
          <button
            type="button"
            className="inline-flex h-5 cursor-pointer items-center gap-0.5 rounded text-[0.75rem] font-medium text-gold-soft hover:text-gold"
            onClick={onDetails}
          >
            Details
            <ChevronRight className="size-3.5" aria-hidden />
          </button>
        }
      >
        <SlotGrid
          items={effects}
          columns={2}
          empty="Normal numbers"
          onMore={onDetails}
        />
      </StatusSection>
    </>
  );
}

/** `againstGary`: the roll belongs to an enemy, so Advantage is bad news */
function rollBadge(effect: RollEffect, againstGary = false) {
  if (effect.roll === "normal") {
    if (effect.advantage.length > 0 && effect.disadvantage.length > 0) {
      return <span className={cx(CHIP, TONE_CHIP.neutral)}>Adv + Dis cancel</span>;
    }
    return null;
  }
  const good = (effect.roll === "advantage") !== againstGary;
  const Icon = effect.roll === "advantage" ? ChevronsUp : ChevronsDown;
  return (
    <span className={cx(CHIP, TONE_CHIP[good ? "good" : "bad"])}>
      <Icon className="size-3" aria-hidden />
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

const EFFECT_ROW =
  "grid grid-cols-1 gap-1 border-t border-line/70 py-2.5 first:border-t-0 first:pt-0 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-3";
const EFFECT_LABEL =
  "flex items-center gap-1.5 text-[0.85rem] text-muted [&>svg]:size-3.5 [&>svg]:text-gold/75";
const EFFECT_DETAIL = "basis-full text-[0.8rem] leading-snug text-faint";

function EffectRow({
  label,
  icon: Icon,
  value,
  badge,
  detail,
}: {
  label: ReactNode;
  icon: LucideIcon;
  value: ReactNode;
  badge?: ReactNode;
  detail?: string;
}) {
  return (
    <div className={EFFECT_ROW}>
      <div className={EFFECT_LABEL}>
        <Icon aria-hidden />
        {label}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-semibold tabular-nums">{value}</span>
        {badge}
        {detail ? <div className={EFFECT_DETAIL}>{detail}</div> : null}
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
    <div className="flex flex-col">
      <EffectRow
        label="Actions"
        icon={Hourglass}
        value={e.cantAct.length > 0 ? "None" : "Normal"}
        badge={
          e.cantAct.length > 0 ? (
            <span className={cx(CHIP, TONE_CHIP.bad)}>No Action / BA / Reaction</span>
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
        icon={Swords}
        value={`${signed(GARY.attack - pen)} to hit`}
        badge={rollBadge(e.attack)}
        detail={joinDetail(rollReasons(e.attack), penaltyNote)}
      />
      <EffectRow
        label="Athletics"
        icon={BicepsFlexed}
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
      <div className={EFFECT_ROW}>
        <div className={EFFECT_LABEL}>
          <Shield aria-hidden />
          Saves
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <div className="grid w-full grid-cols-3 gap-1.5 min-[420px]:grid-cols-6">
            {ABILITIES.map(({ id, label }) => {
              const s = e.saves[id];
              const fail = s.autoFail.length > 0;
              const changed = fail || pen > 0 || s.effect.roll !== "normal";
              return (
                <div
                  key={id}
                  className={cx(
                    "flex flex-col items-center rounded-md border px-0.5 py-1",
                    fail
                      ? "border-crimson/50 bg-crimson/20 text-crimson-soft"
                      : changed
                        ? "border-crimson/50 bg-well/70"
                        : "border-line bg-well/70",
                  )}
                >
                  <span
                    className={cx(
                      "text-[0.65rem] font-semibold uppercase tracking-wider",
                      fail ? "text-[inherit]" : "text-faint",
                    )}
                  >
                    {label}
                  </span>
                  <span className="text-[0.9rem] font-semibold tabular-nums">
                    {fail ? "Fail" : signed(GARY.saves[id] - pen)}
                    {!fail && s.effect.roll === "disadvantage" ? " Dis" : ""}
                  </span>
                </div>
              );
            })}
          </div>
          <div className={EFFECT_DETAIL}>
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
        icon={ShieldHalf}
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
        icon={Footprints}
        value={`${e.speed.value} ft`}
        detail={joinDetail(
          e.speed.zeroBy.length > 0 ? `0 from ${reasonText(e.speed.zeroBy)}` : undefined,
          pen > 0 ? `Exhaustion −${5 * (sheet.exhaustion ?? 0)} ft` : undefined,
          ...e.speed.notes,
        )}
      />
      <EffectRow
        label="Initiative"
        icon={Zap}
        value={signed(GARY.initiative - pen)}
        badge={rollBadge(e.initiative)}
        detail={joinDetail(rollReasons(e.initiative), penaltyNote)}
      />
      {e.resistAll.length > 0 ? (
        <EffectRow
          label="Damage"
          icon={ShieldCheck}
          value="Resist all"
          detail={`${reasonText(e.resistAll)} — the Hit tab halves damage automatically`}
        />
      ) : null}
      {e.notes.length > 0 ? (
        <EffectRow
          label="Also"
          icon={Info}
          value=""
          detail={e.notes.join(" · ")}
        />
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
  const bloodied = isBloodied(sheet.hp);
  return (
    <Card>
      <div className="flex flex-col gap-4 p-4">
        <div className="min-w-0">
          <div className="flex flex-nowrap items-end gap-2 whitespace-nowrap">
            <Heart
              className={cx(
                "mb-1 size-6 shrink-0",
                bloodied ? "fill-crimson/40 text-crimson-soft" : "fill-gold/15 text-gold",
              )}
              aria-hidden
            />
            <span className="text-[2.5rem] leading-none font-semibold tracking-tight tabular-nums">
              {sheet.hp}
            </span>
            {sheet.tempHp > 0 ? (
              <span className="mb-1 inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-sm font-semibold text-gold-soft tabular-nums">
                <Shield className="size-3.5" aria-hidden />+{sheet.tempHp}
              </span>
            ) : null}
            <span className="mb-1 text-sm whitespace-nowrap text-faint tabular-nums">
              / {HP_MAX} HP
            </span>
          </div>
          <div
            className="mt-3 h-2.5 overflow-hidden rounded-full border border-line bg-well"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={HP_MAX}
            aria-valuenow={sheet.hp}
            aria-label="Hit points"
          >
            <div
              className={cx(
                "h-full rounded-full bg-gradient-to-r transition-[width] duration-150",
                bloodied
                  ? "from-crimson to-crimson-soft"
                  : "from-gold-deep to-gold-soft",
              )}
              style={{ width: `${Math.round((sheet.hp / HP_MAX) * 100)}%` }}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex flex-col gap-0.5">
            <div className="inline-flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted">
              <Flame className="size-3.5 text-gold" aria-hidden />
              <Tip id="moxie">Moxie</Tip>
            </div>
            <Text tone="tertiary" className="tabular-nums">
              {sheet.moxie}/{MOXIE_MAX}
              {sheet.moxie === 0 ? " · spends locked" : ""}
            </Text>
          </div>
          <Row gap={6} wrap>
            {Array.from({ length: MOXIE_MAX }, (_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Set Moxie to ${i + 1}`}
                className={cx(
                  "size-7 cursor-pointer rounded-full border p-0 transition-colors",
                  i < sheet.moxie
                    ? "border-gold bg-gradient-to-b from-gold-soft to-gold shadow-[0_0_10px_-2px_rgba(197,160,89,0.8)]"
                    : "border-line bg-well hover:border-gold/50",
                )}
                onClick={() =>
                  setSheet((s) => ({ ...s, moxie: i + 1 }))
                }
              />
            ))}
          </Row>
        </div>
      </div>
      <div className="flex flex-col gap-2.5 border-t border-line/80 bg-well/30 px-4 pt-2.5 pb-3">
        <StatusPanels sheet={sheet} onDetails={onEffectsDetails} />
      </div>
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
  const [referenceOpen, setReferenceOpen] = useState(false);

  return (
    <Stack gap={14}>
      <Text tone="secondary">
        Tap what currently applies. The numbers above update automatically.
      </Text>

      <div className="flex flex-col gap-1.5">
        <FieldLabel icon={BatteryLow}>
          <Tip id="exhaustion">Exhaustion</Tip>
        </FieldLabel>
        <div className="grid grid-cols-4 gap-1 rounded-xl border border-line bg-well/70 p-1 sm:grid-cols-7">
          {Array.from({ length: 7 }, (_, level) => {
            const on = exhaustion === level;
            const dead = level === EXHAUSTION_DEATH;
            return (
              <button
                key={level}
                type="button"
                aria-pressed={on}
                className={cx(
                  "inline-flex min-h-10 cursor-pointer items-center justify-center gap-1 rounded-lg text-sm font-medium tabular-nums transition-colors",
                  on
                    ? dead
                      ? "bg-crimson text-ink"
                      : "bg-gradient-to-b from-gold-soft to-gold text-void"
                    : "text-muted hover:bg-raised hover:text-ink",
                )}
                onClick={() =>
                  setSheet((s) => ({ ...normalizeSheet(s), exhaustion: level }))
                }
              >
                {dead ? <Skull className="size-3.5" aria-hidden /> : null}
                {level === 0
                  ? "None"
                  : dead
                    ? `${level} · dead`
                    : String(level)}
              </button>
            );
          })}
        </div>
        <Text tone="tertiary" className="min-h-10">
          {exhaustion === 0
            ? "No Exhaustion."
            : exhaustion >= EXHAUSTION_DEATH
              ? "Level 6: Gary dies."
              : `Level ${exhaustion}: −${2 * exhaustion} to every d20 test, −${5 * exhaustion} ft speed.${
                  exhaustion === EXHAUSTION_DEATH - 1
                    ? " One more level kills Gary — no more Dig Deep."
                    : ""
                }`}
        </Text>
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {CONDITION_DEFS.map((c) => {
          const on = Boolean(conditions[c.id]);
          return (
            <button
              key={c.id}
              type="button"
              className={cx(
                "flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-left text-sm transition-colors",
                on
                  ? "border-gold/70 bg-gold/12 font-semibold text-gold-soft"
                  : "border-line bg-well/60 text-muted hover:border-gold/40 hover:text-ink",
              )}
              aria-pressed={on}
              onClick={() => toggle(c.id)}
            >
              {on ? (
                <CircleCheck className="size-4 shrink-0 text-gold" aria-hidden />
              ) : (
                <Circle className="size-4 shrink-0 text-faint" aria-hidden />
              )}
              {c.label}
            </button>
          );
        })}
      </div>

      {active.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {active.map((c) => (
            <div
              key={c.id}
              className="animate-pop-in rounded-lg border border-line border-l-[3px] border-l-gold bg-well/60 px-3 py-2"
            >
              <div className="mb-0.5 flex items-baseline justify-between gap-2">
                <strong className="text-sm text-gold-soft">{c.label}</strong>
                <a
                  className="inline-flex items-center gap-1 text-xs"
                  href={conditionHref(c.label)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Rules
                  <ExternalLink className="size-3" aria-hidden />
                </a>
              </div>
              <Text tone="secondary" className="text-[0.88rem] leading-snug">
                {c.summary}
              </Text>
            </div>
          ))}
        </div>
      ) : null}

      <Row gap={8} wrap>
        <Button
          variant="ghost"
          icon={Eraser}
          disabled={active.length === 0 && exhaustion === 0}
          onClick={clearConditions}
        >
          Clear all conditions
        </Button>
        <Button
          variant="ghost"
          icon={BookOpen}
          onClick={() => setReferenceOpen(true)}
        >
          What every condition does
        </Button>
      </Row>

      <Drawer
        open={referenceOpen}
        onClose={() => setReferenceOpen(false)}
        title="Conditions"
        icon={BookOpen}
      >
        <Stack gap={10}>
          <Text tone="tertiary">
            From the 2024 rules on D&D Beyond.{" "}
            <a
              className="inline-flex items-center gap-1"
              href={RULES_GLOSSARY_URL}
              target="_blank"
              rel="noreferrer"
            >
              Rules Glossary
              <ExternalLink className="size-3" aria-hidden />
            </a>
          </Text>
          <GlossaryItem label="Exhaustion" summary={EXHAUSTION_SUMMARY} />
          <GlossaryList kind="condition" />
        </Stack>
      </Drawer>
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
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        <label className={RESOURCE_ROW}>
          <input
            type="checkbox"
            className={CHECKBOX}
            checked={sheet.bloodiedUnbowed}
            onChange={(e) => patch({ bloodiedUnbowed: e.target.checked })}
          />
          <Droplet className={RESOURCE_ICON} aria-hidden />
          <span className="min-w-0">
            <Tip id="bloodied-but-unbowed">Bloodied But Unbowed</Tip>
            <span className={RESOURCE_NOTE}>1 / short rest</span>
          </span>
        </label>
        <label className={RESOURCE_ROW}>
          <input
            type="checkbox"
            className={CHECKBOX}
            checked={sheet.swagger}
            onChange={(e) => patch({ swagger: e.target.checked })}
          />
          <Sparkles className={RESOURCE_ICON} aria-hidden />
          <span className="min-w-0">
            <Tip id="swagger-streak">Swagger Streak</Tip>
            <span className={RESOURCE_NOTE}>1 / short rest</span>
          </span>
        </label>
        <label className={RESOURCE_ROW}>
          <input
            type="checkbox"
            className={CHECKBOX}
            checked={sheet.digDeep}
            onChange={(e) =>
              patch({
                digDeep: e.target.checked,
                digDeepActive: e.target.checked ? sheet.digDeepActive : false,
              })
            }
          />
          <Pickaxe className={RESOURCE_ICON} aria-hidden />
          <span className="min-w-0">
            <Tip id="dig-deep">Dig Deep</Tip>
            <span className={RESOURCE_NOTE}>free first use</span>
          </span>
        </label>
        <label
          className={cx(
            RESOURCE_ROW,
            !sheet.digDeep && !sheet.digDeepActive && "opacity-50",
          )}
        >
          <input
            type="checkbox"
            className={CHECKBOX}
            checked={sheet.digDeepActive}
            disabled={!sheet.digDeep && !sheet.digDeepActive}
            onChange={(e) => patch({ digDeepActive: e.target.checked })}
          />
          <ShieldCheck className={RESOURCE_ICON} aria-hidden />
          <span className="min-w-0">
            <Tip id="dig-deep">Dig Deep active</Tip>
            <span className={RESOURCE_NOTE}>resist nonmagical B/P/S</span>
          </span>
        </label>
      </div>
      <Stack gap={6}>
        <Row gap={8} wrap>
          <Button
            variant="secondary"
            icon={Pickaxe}
            disabled={
              sheet.digDeep ||
              sheet.digDeepActive ||
              !canDigDeepAgain(sheet.exhaustion)
            }
            onClick={() =>
              setSheet((s) =>
                !s.digDeep && !s.digDeepActive && canDigDeepAgain(s.exhaustion)
                  ? { ...s, digDeepActive: true, exhaustion: s.exhaustion + 1 }
                  : s,
              )
            }
          >
            Dig Deep again (+1 Exhaustion)
          </Button>
        </Row>
        <Text tone="tertiary" className="min-h-10">
          {sheet.digDeepActive
            ? "Dig Deep is active."
            : sheet.digDeep
              ? "The free Dig Deep is still unused — tick it above first."
              : `Dig Deep ${digDeepAgainNote(sheet.exhaustion)}`}
        </Text>
      </Stack>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          icon={Coffee}
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
          icon={Moon}
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
      </div>
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

function d20LogEntry({
  label,
  dice,
  kept,
  bonus,
  mode,
  attack = false,
  autoFail = false,
}: {
  label: string;
  dice: number[];
  kept: number;
  bonus: number;
  mode: RollEffect["roll"];
  attack?: boolean;
  autoFail?: boolean;
}): NewRoll {
  const suffix =
    mode === "advantage" ? " (adv)" : mode === "disadvantage" ? " (dis)" : "";
  const faces =
    dice.length === 1 ? `d20 (${kept})` : `d20 (${dice.join(", ")} → ${kept})`;
  const miss = attack && !autoFail && kept === 1;
  return {
    label,
    expression: `${withModifier("1d20", bonus)}${suffix}`,
    breakdown: withModifier(faces, bonus),
    total: kept + bonus,
    result: autoFail ? "Fail" : miss ? "Miss" : undefined,
    flag: autoFail
      ? "fail"
      : miss
        ? "miss"
        : attack && kept === 20
          ? "crit"
          : undefined,
  };
}

function damageLogEntry(dice: number[], crit: boolean): NewRoll {
  const bonus = GARY.fisticuffsBonus;
  const notation = `${dice.length}d${GARY.fisticuffsDie}`;
  return {
    label: crit ? "Unarmed damage · crit" : "Unarmed damage",
    expression: withModifier(notation, bonus),
    breakdown: withModifier(`${notation} (${dice.join(", ")})`, bonus),
    total: dice.reduce((sum, n) => sum + n, 0) + bonus,
    flag: crit ? "crit" : undefined,
  };
}

function CritToggle({ tile = false }: { tile?: boolean }) {
  const { crit, setCrit } = useRollLog();
  const on = "border-gold/80 bg-gold/15 text-gold-soft";
  return (
    <button
      type="button"
      aria-pressed={crit}
      aria-label="Critical hit: next damage rolls double dice"
      className={cx(tile ? ROLL_TILE : LINE_ROLL_BTN, crit && on)}
      onClick={() => setCrit(!crit)}
    >
      {tile ? (
        <>
          <span className="inline-flex items-center gap-1.5 text-[0.85rem]">
            <Star
              className={cx("size-3.5", crit ? "fill-current text-gold" : "text-gold/80")}
              aria-hidden
            />
            Crit
          </span>
          <span
            className={cx(
              "text-base font-semibold",
              crit ? "text-gold-soft" : "text-faint",
            )}
          >
            {crit ? "On" : "Off"}
          </span>
        </>
      ) : (
        <>
          <Star className={cx(crit && "fill-current")} aria-hidden />
          {crit ? "Crit on" : "Crit off"}
        </>
      )}
    </button>
  );
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
        const Icon = specIcon(spec);
        return (
          <button
            key={spec.id}
            type="button"
            className={ROLL_TILE}
            disabled={disabled}
            onClick={() => onRoll(spec)}
          >
            <span className="inline-flex items-center gap-1.5 text-[0.85rem]">
              <Icon className="size-3.5 text-gold/80" aria-hidden />
              {spec.label}
            </span>
            <span
              className={cx(
                "text-base font-semibold tabular-nums",
                tone === "bad" && "text-crimson-soft",
                tone === "good" && "text-verdant",
                !tone && "text-ink",
              )}
            >
              {caption}
            </span>
          </button>
        );
  });
  if (bare) return <>{buttons}</>;
  return <div className={ROLL_GRID}>{buttons}</div>;
}

const ROLL_GRID = "grid grid-cols-2 gap-1.5 min-[480px]:grid-cols-3";
const ROLL_TILE =
  "flex min-h-14 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border border-line bg-well/70 px-1.5 py-2 leading-tight text-muted transition-colors hover:border-gold/50 hover:bg-raised/60 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40";
const LINE_ROLL_BTN =
  "inline-flex min-h-10 min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-line bg-well/70 px-2 text-[0.82rem] tabular-nums text-ink transition-colors hover:border-gold/50 hover:bg-raised/60 disabled:cursor-not-allowed disabled:opacity-40 [&>svg]:size-4 [&>svg]:text-gold/80";

function specIcon(spec: D20Spec): LucideIcon {
  if (spec.attack) return Swords;
  if (spec.id.startsWith("save-")) return Shield;
  switch (spec.id) {
    case "athletics":
      return BicepsFlexed;
    case "perception":
      return Eye;
    case "insight":
      return Brain;
    case "initiative":
      return Zap;
    default:
      return Dices;
  }
}

function RollPanel({
  sheet,
  setSheet,
}: {
  sheet: Sheet;
  setSheet: (next: Sheet | ((prev: Sheet) => Sheet)) => void;
}) {
  const [result, setResult] = useState<ShownRoll | null>(null);
  const { record, crit, setCrit } = useRollLog();
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
    const autoFail = spec.autoFail.length > 0;
    record(
      d20LogEntry({
        label: spec.attack ? "Unarmed to hit" : spec.label,
        dice,
        kept,
        bonus: spec.bonus,
        mode,
        attack: spec.attack,
        autoFail,
      }),
    );
    if (spec.attack) setCrit(!autoFail && kept === 20);
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
    record({
      label: `${result.label} + Swagger`,
      expression: "1d10",
      breakdown: `d10 (${die}): ${result.total} → ${result.total + die}`,
      total: result.total + die,
    });
    setResult({
      ...result,
      total: result.total + die,
      swagger: false,
      swaggerDie: die,
    });
  }

  function rollDamage() {
    const dice = Array.from({ length: crit ? 2 : 1 }, () =>
      rollDie(GARY.fisticuffsDie),
    );
    const bonus = GARY.fisticuffsBonus;
    record(damageLogEntry(dice, crit));
    setCrit(false);
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
      {result ? (
        <RollReadout result={result} onSwagger={addSwagger} />
      ) : (
        <div className={cx(ROLL_SLOT, ROLL_EMPTY)}>
          <Dices className="size-6 text-faint" aria-hidden />
          Tap a save, check, or attack. The result lands here.
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <FieldLabel icon={Shield}>Saving throws</FieldLabel>
        <RollButtons specs={saves} onRoll={rollD20} />
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldLabel icon={Dices}>Checks</FieldLabel>
        <RollButtons specs={checks} onRoll={rollD20} />
        {effects.checkAutoFail.length > 0 ? (
          <Text tone="tertiary">
            {reasonText(effects.checkAutoFail)} — those checks fail on their
            own, so don’t trust a roll that needed sight or hearing.
          </Text>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldLabel icon={Swords}>Attack</FieldLabel>
        <div className="grid grid-cols-3 gap-1.5">
          <RollButtons
            bare
            specs={[attack]}
            disabled={cantAct}
            onRoll={rollD20}
          />
          <button
            type="button"
            className={ROLL_TILE}
            disabled={cantAct}
            onClick={rollDamage}
          >
            <span className="inline-flex items-center gap-1.5 text-[0.85rem]">
              <Sword className="size-3.5 text-gold/80" aria-hidden />
              Damage
            </span>
            <span
              className={cx(
                "text-base font-semibold tabular-nums",
                crit ? "text-gold-soft" : "text-ink",
              )}
            >
              {crit ? 2 : 1}d{GARY.fisticuffsDie}+{GARY.fisticuffsBonus}
            </span>
          </button>
          <CritToggle tile />
        </div>
        {attackNote ? <Text tone="tertiary">{attackNote}</Text> : null}
        <Text tone="tertiary">
          A natural 20 turns Crit on; the next damage roll doubles its dice and
          turns it off. Tap Crit to set it yourself. Every roll lands in the
          Dice log.
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
      <div className={ROLL_RESULT}>
        <div className={ROLL_RESULT_LABEL}>
          <Sword className="size-3.5 text-gold" aria-hidden />
          {result.crit ? "Damage · critical hit" : "Damage"}
        </div>
        <div className={ROLL_TOTAL}>{result.total}</div>
        <div className={ROLL_MATH}>
          {result.dice.length}d{GARY.fisticuffsDie} {result.dice.join("+")} +{" "}
          {result.bonus} = {result.total} bludgeoning
        </div>
      </div>
    );
  }

  if (result.kind === "brace") {
    return (
      <div className={ROLL_RESULT}>
        <div className={ROLL_RESULT_LABEL}>
          <ShieldPlus className="size-3.5 text-gold" aria-hidden />
          Brace Up
        </div>
        <div className={ROLL_TOTAL}>+{result.total}</div>
        <div className={ROLL_MATH}>
          d{GARY.fisticuffsDie} {result.die} + {result.bonus} = {result.total} temp
        </div>
        <div className={ROLL_NOTES}>
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
    <div className={ROLL_RESULT}>
      <div className={ROLL_RESULT_LABEL}>
        <Dices className="size-3.5 text-gold" aria-hidden />
        {result.label}
      </div>
      <div
        className={cx(
          ROLL_TOTAL,
          (result.autoFail || miss) && "text-crimson-soft",
          crit && "text-gold-soft",
        )}
      >
        {result.autoFail ? "Fail" : miss ? "Miss" : result.total}
      </div>
      <div className={ROLL_MATH}>{math}</div>
      {crit ? (
        <div className={cx(ROLL_FLAG, "text-verdant")}>
          <Star className="size-4 fill-current" aria-hidden />
          Critical hit
        </div>
      ) : null}
      {miss ? (
        <div className={cx(ROLL_FLAG, "text-crimson-soft")}>
          <Skull className="size-4" aria-hidden />
          Natural 1 — automatic miss
        </div>
      ) : null}
      {result.autoFail ? (
        <div className={cx(ROLL_FLAG, "text-crimson-soft")}>
          <Ban className="size-4" aria-hidden />
          Automatic failure · {result.autoFail}
        </div>
      ) : null}
      {result.notes ? <div className={ROLL_NOTES}>{result.notes}</div> : null}
      {result.swagger ? (
        <Button variant="secondary" icon={Sparkles} onClick={onSwagger}>
          Add Swagger +1d10
        </Button>
      ) : null}
    </div>
  );
}

const ROLL_SLOT =
  "flex min-h-[15.5rem] flex-col items-center justify-center gap-1.5 rounded-xl border px-4 py-4 text-center";
const ROLL_EMPTY = "border-dashed border-line text-sm text-faint";
const ROLL_RESULT = cx(
  ROLL_SLOT,
  "animate-pop-in border-gold/30 bg-gradient-to-b from-raised/60 to-well/80 shadow-[0_10px_30px_-18px_rgba(197,160,89,0.6)]",
);
const ROLL_RESULT_LABEL =
  "inline-flex items-center gap-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-muted";
const ROLL_TOTAL =
  "font-display text-5xl leading-none font-semibold tabular-nums text-ink";
const ROLL_MATH = "text-sm tabular-nums text-muted";
const ROLL_NOTES = "line-clamp-3 text-[0.8rem] leading-snug text-faint";
const ROLL_FLAG = "inline-flex items-center gap-1.5 text-sm font-semibold";

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
  const { record, crit, setCrit } = useRollLog();
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
    record(
      d20LogEntry({
        label: "Unarmed to hit",
        dice: diceRoll,
        kept,
        bonus: attackBonus,
        mode,
        attack: true,
      }),
    );
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
    record(damageLogEntry(rolled, crit));
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
    record({
      label: "Brace Up (temp HP)",
      expression: withModifier(`1d${GARY.fisticuffsDie}`, GARY.braceBonus),
      breakdown: withModifier(`d${GARY.fisticuffsDie} (${die})`, GARY.braceBonus),
      total,
    });
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
    record({
      label: "Swagger Streak",
      expression: "1d10",
      breakdown: `d10 (${die})`,
      total: die,
    });
    setLine(`Swagger +${die}`);
  }

  return (
    <Stack gap={6}>
      <div className="grid grid-cols-2 gap-1.5">
        {dice.includes("attack") ? (
          <button
            type="button"
            className={LINE_ROLL_BTN}
            disabled={cantAct}
            onClick={rollAttack}
          >
            <Target aria-hidden />
            To hit {signed(attackBonus)}
            {attackMode ? ` ${attackMode}` : ""}
          </button>
        ) : null}
        {dice.includes("damage") ? (
          <button
            type="button"
            className={cx(LINE_ROLL_BTN, crit && "border-gold/70 text-gold-soft")}
            disabled={cantAct}
            onClick={rollDamage}
          >
            <Sword aria-hidden />
            {crit
              ? `Crit 2d${GARY.fisticuffsDie}+${GARY.fisticuffsBonus}`
              : `Damage 1d${GARY.fisticuffsDie}+${GARY.fisticuffsBonus}`}
          </button>
        ) : null}
        {dice.includes("damage") ? <CritToggle /> : null}
        {dice.includes("brace") ? (
          <button type="button" className={LINE_ROLL_BTN} onClick={rollBrace}>
            <ShieldPlus aria-hidden />
            Brace Up 1d{GARY.fisticuffsDie}+{GARY.braceBonus}
          </button>
        ) : null}
        {dice.includes("swagger") ? (
          <button
            type="button"
            className={LINE_ROLL_BTN}
            disabled={!sheet.swagger}
            onClick={rollSwagger}
          >
            <Sparkles aria-hidden />
            {sheet.swagger ? "Swagger +1d10" : "Swagger used"}
          </button>
        ) : null}
      </div>
      <div
        className={cx(
          "flex h-11 items-center gap-1.5 rounded-md border px-2.5 text-[0.8rem] leading-4 tabular-nums",
          line
            ? "border-gold/25 bg-gold/[0.06] text-gold-soft"
            : "border-dashed border-line text-faint",
        )}
        aria-live="polite"
      >
        <Dices className="size-3.5 shrink-0" aria-hidden />
        <span key={line ?? ""} className="line-clamp-2 animate-pop-in">
          {line ?? "Roll results show here."}
        </span>
      </div>
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
const MAX_PER_DIE = 20;
const MAX_MODIFIER = 30;

type DieSides = (typeof DICE_SIDES)[number];
type DicePool = Partial<Record<DieSides, number>>;

function poolGroups(pool: DicePool) {
  return DICE_SIDES.filter((sides) => (pool[sides] ?? 0) > 0)
    .reverse()
    .map((sides) => ({ sides, count: pool[sides] ?? 0 }));
}

function withModifier(text: string, modifier: number) {
  if (modifier === 0) return text;
  return `${text} ${modifier > 0 ? "+" : "−"} ${Math.abs(modifier)}`;
}

function diceExpression(
  groups: { sides: number; count: number }[],
  modifier: number,
) {
  return withModifier(
    groups.map((g) => `${g.count}d${g.sides}`).join(" + "),
    modifier,
  );
}

const FLAG_TONE: Record<NonNullable<RollLogEntry["flag"]>, string> = {
  crit: "text-gold-soft",
  miss: "text-crimson-soft",
  fail: "text-crimson-soft",
};

function DiceRoller() {
  const [open, setOpen] = useState(false);
  const [pool, setPool] = useState<DicePool>({ 20: 1 });
  const [modifier, setModifier] = useState(0);
  const { log, record, clear } = useRollLog();
  const [hidden, setHidden] = usePersistentState(
    "gary-grapplesauce-combat:dice-hidden",
    false,
  );
  const latest = log[0];
  const groups = poolGroups(pool);
  const expression = diceExpression(groups, modifier);

  useEffect(() => {
    if (!open) return;
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function adjust(sides: DieSides, delta: number) {
    setPool((p) => ({
      ...p,
      [sides]: clamp((p[sides] ?? 0) + delta, 0, MAX_PER_DIE),
    }));
  }

  function clearPool() {
    setPool({});
    setModifier(0);
  }

  function roll() {
    if (groups.length === 0) return;
    const rolled = groups.map((g) => ({
      sides: g.sides,
      faces: Array.from({ length: g.count }, () => rollDie(g.sides)),
    }));
    const total =
      rolled.reduce(
        (sum, g) => sum + g.faces.reduce((s, face) => s + face, 0),
        0,
      ) + modifier;
    record({
      label: "Dice tray",
      expression,
      breakdown: withModifier(
        rolled
          .map((g) => `${g.faces.length}d${g.sides} (${g.faces.join(", ")})`)
          .join(" + "),
        modifier,
      ),
      total,
    });
  }

  const DICE_KEY =
    "min-h-10 cursor-pointer rounded-lg border text-sm font-medium tabular-nums transition-colors";
  const STEP =
    "grid size-7 shrink-0 cursor-pointer place-items-center rounded-md border border-line bg-well/70 text-ink hover:border-gold/50 disabled:cursor-not-allowed disabled:opacity-40";
  const HEADER_BTN =
    "inline-flex h-7 cursor-pointer items-center gap-1 rounded-md px-1.5 text-xs text-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-40";
  const SECTION_LABEL =
    "text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-faint";
  const MASK = "•••";

  return createPortal(
    <div className="fixed right-3 bottom-3 z-40 flex flex-col items-end gap-2">
      {open ? (
        <div
          className="flex h-[min(80vh,600px)] w-[min(300px,calc(100vw-24px))] animate-pop-in flex-col gap-2.5 overflow-hidden rounded-2xl border border-gold/30 bg-surface p-3 shadow-[0_24px_48px_-16px_rgba(0,0,0,0.9)]"
          role="dialog"
          aria-label="Dice"
        >
          <div className="flex h-7 shrink-0 items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-display text-xs font-semibold uppercase tracking-[0.16em] text-gold-soft">
              <Dices className="size-4 text-gold" aria-hidden />
              Dice tray
            </div>
            <div className="flex items-center">
              <button
                type="button"
                className={HEADER_BTN}
                aria-pressed={hidden}
                onClick={() => setHidden((h) => !h)}
              >
                {hidden ? (
                  <EyeOff className="size-3.5" aria-hidden />
                ) : (
                  <Eye className="size-3.5" aria-hidden />
                )}
                {hidden ? "Show" : "Hide"}
              </button>
              <button
                type="button"
                className={HEADER_BTN}
                disabled={groups.length === 0 && modifier === 0}
                onClick={clearPool}
              >
                <Eraser className="size-3.5" aria-hidden />
                Reset
              </button>
            </div>
          </div>

          <div className="grid shrink-0 grid-cols-4 gap-1.5">
            {DICE_SIDES.map((n) => {
              const count = pool[n] ?? 0;
              return (
                <button
                  key={n}
                  type="button"
                  className={cx(
                    DICE_KEY,
                    "relative",
                    count > 0
                      ? "border-gold/80 bg-gold/15 text-gold-soft"
                      : "border-line bg-well/70 text-ink hover:border-gold/50",
                  )}
                  aria-label={`Add a d${n} (${count} in pool)`}
                  disabled={count >= MAX_PER_DIE}
                  onClick={() => adjust(n, 1)}
                >
                  d{n}
                  {count > 0 ? (
                    <span className="absolute -top-1.5 -right-1.5 grid min-w-5 place-items-center rounded-full bg-gold px-1 text-[0.68rem] font-bold text-void">
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="flex h-9 shrink-0 flex-nowrap items-center gap-1.5 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {groups.length === 0 ? (
              <span className="text-xs text-faint">
                Tap dice above to build a roll.
              </span>
            ) : (
              groups.map((g) => (
                <span
                  key={g.sides}
                  className="inline-flex h-8 shrink-0 animate-pop-in items-center gap-1.5 rounded-lg bg-well/70 pr-0.5 pl-2.5"
                >
                  <span className="text-sm font-semibold tabular-nums">
                    {g.count}d{g.sides}
                  </span>
                  <button
                    type="button"
                    className={STEP}
                    aria-label={`Remove a d${g.sides}`}
                    onClick={() => adjust(g.sides, -1)}
                  >
                    <Minus className="size-3.5" aria-hidden />
                  </button>
                </span>
              ))
            )}
          </div>

          <div className="flex h-9 shrink-0 items-center justify-between gap-2 rounded-lg bg-well/60 pr-1 pl-2.5">
            <span className="text-sm text-muted">Modifier</span>
            <span className="flex items-center gap-1">
              <button
                type="button"
                className={STEP}
                aria-label="Lower modifier"
                disabled={modifier <= -MAX_MODIFIER}
                onClick={() => setModifier((m) => Math.max(-MAX_MODIFIER, m - 1))}
              >
                <Minus className="size-3.5" aria-hidden />
              </button>
              <span className="w-[3ch] text-center text-sm font-semibold tabular-nums">
                {signed(modifier)}
              </span>
              <button
                type="button"
                className={STEP}
                aria-label="Raise modifier"
                disabled={modifier >= MAX_MODIFIER}
                onClick={() => setModifier((m) => Math.min(MAX_MODIFIER, m + 1))}
              >
                <Plus className="size-3.5" aria-hidden />
              </button>
            </span>
          </div>

          <Button
            variant="primary"
            icon={Dices}
            className="w-full shrink-0"
            disabled={groups.length === 0}
            onClick={roll}
          >
            <span className="min-w-0 truncate">
              {groups.length === 0 ? "Add a die" : `Roll ${expression}`}
            </span>
          </Button>

          <div className="flex h-[5.25rem] shrink-0 flex-col items-center justify-center rounded-xl border border-line bg-well/50 px-2 text-center">
            {latest ? (
              <>
                <div
                  key={`${latest.id}-${hidden}`}
                  className={cx(
                    "animate-pop-in font-display text-[2.4rem] leading-none font-semibold tabular-nums",
                    hidden
                      ? "text-faint"
                      : latest.flag
                        ? FLAG_TONE[latest.flag]
                        : "text-gold-soft",
                  )}
                  aria-label={hidden ? "Result hidden" : undefined}
                >
                  {hidden ? MASK : (latest.result ?? latest.total)}
                </div>
                <div className="mt-1 line-clamp-2 h-8 w-full text-[0.72rem] leading-4 tabular-nums text-faint">
                  <span className="text-muted">{latest.label}</span> ·{" "}
                  {hidden ? latest.expression : latest.breakdown}
                </div>
              </>
            ) : (
              <span className="text-[0.8rem] text-faint">Nothing rolled yet.</span>
            )}
          </div>

          <div className="flex h-6 shrink-0 items-center justify-between gap-2">
            <span className={SECTION_LABEL}>
              All rolls{log.length > 1 ? ` · ${log.length - 1} earlier` : ""}
            </span>
            <button
              type="button"
              className={HEADER_BTN}
              disabled={log.length === 0}
              onClick={clear}
            >
              <Trash2 className="size-3.5" aria-hidden />
              Clear log
            </button>
          </div>

          <ol className="m-0 flex min-h-0 flex-1 list-none flex-col gap-1 overflow-y-auto border-t border-line p-0 pt-2">
            {log.length > 1 ? (
              log.slice(1).map((entry) => (
                <li
                  key={entry.id}
                  className="flex shrink-0 justify-between gap-2 text-[0.8rem] tabular-nums text-muted"
                >
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <History className="size-3 shrink-0 text-faint" aria-hidden />
                    <span className="truncate">
                      <span className="text-ink/85">{entry.label}</span>
                      <span className="text-faint"> · {entry.expression}</span>
                    </span>
                  </span>
                  <span
                    className={cx(
                      "shrink-0 font-semibold",
                      hidden
                        ? "text-faint"
                        : entry.flag
                          ? FLAG_TONE[entry.flag]
                          : "text-ink",
                    )}
                  >
                    {hidden ? MASK : (entry.result ?? entry.total)}
                  </span>
                </li>
              ))
            ) : (
              <li className="text-[0.8rem] text-faint">No earlier rolls.</li>
            )}
          </ol>
        </div>
      ) : null}
      <button
        type="button"
        className={cx(
          "inline-flex h-14 cursor-pointer items-center gap-2 rounded-full border px-5 font-display text-sm font-semibold tracking-[0.12em] uppercase shadow-[0_12px_28px_-8px_rgba(0,0,0,0.85)] transition-colors",
          open
            ? "border-gold/60 bg-surface text-gold-soft"
            : "border-gold bg-gradient-to-b from-gold-soft to-gold text-void",
        )}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <X className="size-5" aria-hidden />
        ) : (
          <Dices className="size-5" aria-hidden />
        )}
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
  const [rollLog, setRollLog] = usePersistentState<RollLogEntry[]>(
    "gary-grapplesauce-combat:roll-log",
    [],
  );
  const [crit, setCrit] = usePersistentState(
    "gary-grapplesauce-combat:crit",
    false,
  );
  const rollApi = useMemo<RollLogApi>(
    () => ({
      log: rollLog,
      record: (roll) =>
        setRollLog((prev) =>
          [{ ...roll, id: rollId(), at: Date.now() }, ...prev].slice(
            0,
            ROLL_LOG_MAX,
          ),
        ),
      clear: () => setRollLog([]),
      crit,
      setCrit,
    }),
    [rollLog, setRollLog, crit, setCrit],
  );

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

  const [reference, setReference] = useState<"cheat" | "glossary" | null>(
    null,
  );
  const attackTone =
    cantAct || penalty > 0 || effects.attack.roll === "disadvantage"
      ? "bad"
      : effects.attack.roll === "advantage"
        ? "good"
        : "normal";

  return (
    <RollLogContext.Provider value={rollApi}>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start lg:gap-6">
      <Stack gap={14} className="lg:sticky lg:top-4">
        <header className="flex flex-col gap-3">
          <div>
            <div className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-faint">
              Pugilist 9 · Squared Circle
            </div>
            <h1 className="text-[1.9rem] leading-tight font-semibold text-gold-soft sm:text-4xl">
              Gary Grapplesauce
            </h1>
          </div>
          <div className="relative">
            {effects.dead ? (
              <div className="absolute inset-0 z-10 flex animate-pop-in items-center justify-center gap-2 rounded-lg border border-crimson/60 bg-void/85 text-sm font-semibold text-crimson-soft backdrop-blur-[2px]">
                <Skull className="size-4" aria-hidden />
                Dead · Exhaustion 6
              </div>
            ) : null}
            <div
              className={cx("grid grid-cols-3 gap-1.5", effects.dead && "opacity-30")}
              aria-hidden={effects.dead || undefined}
            >
              <Stat
                icon={Swords}
                label="Attack"
                tone={attackTone}
                value={
                  cantAct
                    ? "Can’t act"
                    : `${signed(GARY.attack - penalty)}${attackMode ? ` ${attackMode}` : ""}`
                }
              />
              <Stat icon={Sword} label="Damage" value={GARY.damage.split(" ")[0]} />
              <Stat icon={ShieldHalf} label="AC" value={GARY.ac} />
              <Stat
                icon={BicepsFlexed}
                label="Athletics"
                tone={penalty > 0 ? "bad" : "normal"}
                value={signed(GARY.athletics - penalty)}
              />
              <Stat
                icon={Footprints}
                label="Speed"
                tone={effects.speed.value !== GARY.speed ? "bad" : "normal"}
                value={`${effects.speed.value} ft`}
              />
              <Stat
                icon={Zap}
                label="Init"
                tone={penalty > 0 ? "bad" : "normal"}
                value={signed(GARY.initiative - penalty)}
              />
            </div>
          </div>
        </header>

        <StatusBar
          sheet={sheet}
          setSheet={setSheet}
          onEffectsDetails={() => {
            setTab("conds");
            requestAnimationFrame(() =>
              document
                .getElementById(EFFECTS_CARD_ID)
                ?.scrollIntoView({ behavior: "smooth", block: "start" }),
            );
          }}
        />
      </Stack>

      <Stack gap={14} className="min-w-0">
        <div
          className="grid grid-cols-5 gap-1 rounded-xl border border-line bg-well/80 p-1"
          role="tablist"
          aria-label="Main mode"
        >
          {MAIN_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={cx(
                "flex min-h-12 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg text-[0.78rem] font-semibold transition-colors sm:flex-row sm:gap-1.5 sm:text-sm",
                tab === id
                  ? "bg-surface text-gold-soft shadow-[inset_0_-2px_0_0_var(--color-gold)]"
                  : "text-muted hover:bg-surface/60 hover:text-ink",
              )}
              onClick={() => setTab(id)}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </button>
          ))}
        </div>

        {(effects.dead && tab !== "conds") || (tab === "play" && cantAct) ? (
          <Callout
            title={effects.dead ? "Gary is dead — Exhaustion 6" : "Gary can’t act"}
            tone="warning"
            icon={effects.dead ? Skull : Ban}
          >
            {effects.dead
              ? "Exhaustion 6 is instant death (no death saves). The decision tree is off. If the DM revives him, lower Exhaustion on the Conds tab."
              : `${reasonText(effects.cantAct)}: no Action, Bonus Action, or Reaction — Moxie options are off until this ends.`}
          </Callout>
        ) : null}

        {tab === "play" ? (
          <Stack gap={12}>
            {!effects.dead && phase === "timing" && (
              <Card>
                <CardHeader icon={Compass}>What just happened?</CardHeader>
                <CardBody>
                  <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
                    <Button
                      variant="primary"
                      icon={Swords}
                      onClick={() => pickTiming("turn")}
                    >
                      My turn
                    </Button>
                    <Button
                      variant="secondary"
                      icon={Zap}
                      onClick={() => pickTiming("reaction")}
                    >
                      Reaction
                    </Button>
                    <Button
                      variant="secondary"
                      icon={RotateCcw}
                      onClick={() => pickTiming("check-fail")}
                    >
                      Failed check
                    </Button>
                  </div>
                </CardBody>
              </Card>
            )}

            {!effects.dead && phase === "reaction" && (
              <Card>
                <CardHeader icon={Zap}>Reaction</CardHeader>
                <CardBody>
                  <Stack gap={12}>
                    <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                      <Button
                        variant="primary"
                        icon={Droplet}
                        disabled={!canBloodiedReaction}
                        onClick={() => pickReaction("bloodied")}
                      >
                        Bloodied + damage
                      </Button>
                      <Button
                        variant="secondary"
                        icon={WandSparkles}
                        onClick={() => pickReaction("mage-cast")}
                      >
                        Spell within 5 ft
                      </Button>
                      <Button
                        variant="secondary"
                        icon={Footprints}
                        onClick={() => pickReaction("opportunity")}
                      >
                        Left my reach
                      </Button>
                      <Button
                        variant="ghost"
                        icon={Hand}
                        onClick={() => pickReaction("other")}
                      >
                        Hold reaction
                      </Button>
                    </div>
                    {bloodiedBlockedReason ? (
                      <Text tone="tertiary" className="inline-flex items-center gap-1.5">
                        <Lock className="size-3.5 shrink-0" aria-hidden />
                        Bloodied locked: {bloodiedBlockedReason}
                      </Text>
                    ) : null}
                    <Button
                      variant="ghost"
                      icon={ArrowLeft}
                      className="w-fit"
                      onClick={resetDecision}
                    >
                      Back
                    </Button>
                  </Stack>
                </CardBody>
              </Card>
            )}

            {!effects.dead && phase === "goal" && (
              <Card>
                <CardHeader icon={Target}>This turn</CardHeader>
                <CardBody>
                  <Stack gap={12}>
                    <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                      {availableGoals.map((g) => (
                        <Button
                          key={g.id}
                          variant={g.variant}
                          icon={GOAL_ICONS[g.id]}
                          onClick={() => pickGoal(g.id)}
                        >
                          {g.cost > 0 ? `${g.label} · ${g.cost}` : g.label}
                        </Button>
                      ))}
                    </div>
                    {hiddenGoals.length > 0 ? (
                      <Text tone="tertiary" className="inline-flex items-center gap-1.5">
                        <Lock className="size-3.5 shrink-0" aria-hidden />
                        Need more Moxie:{" "}
                        {hiddenGoals.map((g) => g.label).join(", ")}
                      </Text>
                    ) : null}
                    <Button
                      variant="ghost"
                      icon={ArrowLeft}
                      className="w-fit"
                      onClick={resetDecision}
                    >
                      Back
                    </Button>
                  </Stack>
                </CardBody>
              </Card>
            )}

            {!effects.dead && phase === "result" && plan && (
              <Card>
                <CardHeader
                  icon={ScrollText}
                  trailing={
                    <Pill active>
                      <Flame className="size-3" aria-hidden />
                      {plan.costLabel}
                    </Pill>
                  }
                >
                  {plan.title}
                </CardHeader>
                <CardBody>
                  <Stack gap={14}>
                    {planSections(plan).map((section, index) => {
                      const Icon = SECTION_ICONS[section.heading] ?? Swords;
                      return (
                        <Stack key={section.heading} gap={6}>
                          {index > 0 ? <Divider /> : null}
                          <h3 className="inline-flex items-center gap-1.5 text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-gold-soft">
                            <Icon className="size-3.5 text-gold" aria-hidden />
                            {section.heading}
                          </h3>
                          <Text>{section.text}</Text>
                          {section.dice.length > 0 ? (
                            <ActionRolls
                              dice={section.dice}
                              sheet={sheet}
                              setSheet={setSheet}
                            />
                          ) : null}
                        </Stack>
                      );
                    })}
                    <div className="rounded-lg border-l-2 border-gold/60 bg-well/50 px-3 py-2 text-sm text-muted italic">
                      {plan.gym}
                    </div>
                    <PlanTips plan={plan} />
                    <Row gap={8} wrap>
                      {applyLabel(plan) ? (
                        <Button
                          variant="primary"
                          icon={spentApplied ? CircleCheck : Check}
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
                      plan.apply === "moxie" ? (
                        <Button
                          variant="secondary"
                          icon={sheet.digDeep ? Pickaxe : CircleCheck}
                          disabled={spentApplied || !sheet.digDeep}
                          onClick={() => {
                            setSheet((s) => ({
                              ...s,
                              digDeep: false,
                              digDeepActive: true,
                            }));
                          }}
                        >
                          {sheet.digDeep ? "Also Dig Deep" : "Dig Deep used"}
                        </Button>
                      ) : null}
                      <Button
                        variant="secondary"
                        icon={RotateCcw}
                        onClick={resetDecision}
                      >
                        New decision
                      </Button>
                      {timing === "turn" ? (
                        <Button
                          variant="ghost"
                          icon={Repeat}
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

            {!effects.dead &&
            !cantAct &&
            effects.d20Penalty === 2 * (EXHAUSTION_DEATH - 1) ? (
              <Callout
                title="Exhaustion 5 — one level from death"
                tone="warning"
                icon={TriangleAlert}
                className="animate-pop-in"
              >
                Don’t Dig Deep again or take anything else that adds Exhaustion.
                A long rest drops it to 4.
              </Callout>
            ) : null}

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                icon={ListOrdered}
                onClick={() => setReference("cheat")}
              >
                Priority cheat sheet
              </Button>
              <Button
                variant="secondary"
                icon={BookOpen}
                onClick={() => setReference("glossary")}
              >
                Rules glossary
              </Button>
            </div>
          </Stack>
        ) : null}

        {tab === "hit" ? (
          <Card>
            <CardHeader icon={HeartCrack}>I took a hit</CardHeader>
            <CardBody>
              <DamageAdjuster sheet={sheet} setSheet={setSheet} />
            </CardBody>
          </Card>
        ) : null}

        {tab === "roll" ? (
          <Card>
            <CardHeader icon={Dices}>Roll</CardHeader>
            <CardBody>
              <RollPanel sheet={sheet} setSheet={setSheet} />
            </CardBody>
          </Card>
        ) : null}

        {tab === "conds" ? (
          <Stack gap={12}>
            <Card>
              <CardHeader icon={ShieldAlert}>Conditions</CardHeader>
              <CardBody>
                <ConditionsPanel sheet={sheet} setSheet={setSheet} />
              </CardBody>
            </Card>
            <div id={EFFECTS_CARD_ID} className="scroll-mt-4">
              <Card>
                <CardHeader icon={Activity}>Effects on Gary right now</CardHeader>
                <CardBody>
                  <ConditionEffectsCard sheet={sheet} />
                </CardBody>
              </Card>
            </div>
          </Stack>
        ) : null}

        {tab === "rest" ? (
          <Card>
            <CardHeader icon={Tent}>Rests & limited uses</CardHeader>
            <CardBody>
              <RestPanel sheet={sheet} setSheet={setSheet} />
            </CardBody>
          </Card>
        ) : null}

        <footer className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-[0.8rem] text-faint">
          <span className="inline-flex items-center gap-1.5">
            <ScrollText className="size-3.5 text-gold/70" aria-hidden />
            Rules:
          </span>
          <a
            className="inline-flex items-center gap-1"
            href={PUGILIST_POST_URL}
            target="_blank"
            rel="noreferrer"
          >
            Pugilist class on D&D Beyond
            <ExternalLink className="size-3" aria-hidden />
          </a>
          <a
            className="inline-flex items-center gap-1"
            href={RULES_GLOSSARY_URL}
            target="_blank"
            rel="noreferrer"
          >
            Conditions (2024 Rules Glossary)
            <ExternalLink className="size-3" aria-hidden />
          </a>
        </footer>
      </Stack>

      <Drawer
        open={reference === "cheat"}
        onClose={() => setReference(null)}
        title="Priority cheat sheet"
        icon={ListOrdered}
      >
        <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
          {[
            "1. Bloodied But Unbowed if eligible.",
            "2. Mage Slayer if they cast within 5 ft.",
            "3. Live? Brace Up or Dig Deep.",
            "4. Move? Stick and Move.",
            "5. Else: Attack → Heavy Hitter → free punch.",
            "6. Lockdown: Stop and Drop → Compression Lock.",
            "7. Burst with One-Two when Moxie allows.",
          ].map((line) => {
            const [num, ...rest] = line.split(". ");
            return (
              <li
                key={line}
                className="flex items-start gap-3 rounded-lg border border-line bg-well/60 px-3 py-2.5"
              >
                <span className="grid size-6 shrink-0 place-items-center rounded-full border border-gold/50 font-display text-xs font-semibold text-gold-soft">
                  {num}
                </span>
                <span className="text-[0.92rem]">{rest.join(". ")}</span>
              </li>
            );
          })}
        </ol>
      </Drawer>

      <Drawer
        open={reference === "glossary"}
        onClose={() => setReference(null)}
        title="Rules glossary (Pugilist)"
        icon={BookOpen}
      >
        <Stack gap={10}>
          <Text tone="tertiary">
            Summaries from the Sterling Vermin Pugilist 2024 write-up, with
            Gary’s level-9 numbers where useful. Tap any ⓘ in the UI for the
            same blurbs.{" "}
            <a
              className="inline-flex items-center gap-1"
              href={PUGILIST_POST_URL}
              target="_blank"
              rel="noreferrer"
            >
              Pugilist on D&D Beyond
              <ExternalLink className="size-3" aria-hidden />
            </a>
          </Text>
          <GlossaryList />
        </Stack>
      </Drawer>

      <DiceRoller />
    </div>
    </RollLogContext.Provider>
  );
}

const EFFECTS_CARD_ID = "gary-effects-now";

const MAIN_TABS: { id: MainTab; label: string; icon: LucideIcon }[] = [
  { id: "play", label: "Play", icon: Swords },
  { id: "hit", label: "Hit", icon: HeartCrack },
  { id: "roll", label: "Roll", icon: Dices },
  { id: "conds", label: "Conds", icon: ShieldAlert },
  { id: "rest", label: "Rest", icon: Tent },
];

const GOAL_ICONS: Record<Goal, LucideIcon> = {
  damage: Sword,
  control: Grab,
  survive: Shield,
  reposition: Footprints,
  mage: WandSparkles,
  unsure: CircleHelp,
};

const SECTION_ICONS: Record<string, LucideIcon> = {
  Action: Swords,
  "Bonus Action": Zap,
  Reaction: Hand,
};
