import { EXHAUSTION_DEATH } from "./conditions";
import { MOXIE_MAX } from "./cost";
import type { ActionApply, ActionPart, CustomAction, GameAction } from "./actions";

/** Fields a move can change. The rest of the sheet is left alone. */
export type SpendFields = {
  moxie: number;
  tempHp: number;
  digDeep: boolean;
  digDeepActive: boolean;
  bloodiedUnbowed: boolean;
  swagger: boolean;
  guardedMind: boolean;
  downButNotOut: boolean;
  exhaustion: number;
};

export type SpendTarget = {
  id: string;
  part: ActionPart;
  moxie: number;
  apply: ActionApply;
  auto?: "brace" | "swagger";
};

export function toSpendTarget(action: GameAction | CustomAction): SpendTarget {
  return {
    id: action.id,
    part: action.part,
    moxie: action.moxie,
    apply: "apply" in action ? action.apply : "moxie",
    auto: "auto" in action ? action.auto : undefined,
  };
}

/** True when Use would change the sheet (a cost, a use, or an automatic roll). */
export function changesSheet(target: SpendTarget) {
  if (target.auto) return true;
  if (target.apply !== "moxie") return true;
  return target.moxie > 0;
}

/**
 * Why Use is off, or null when the move can be spent.
 * Action economy inside a play plan (one bonus, and so on) is separate.
 */
export function blockReason(
  target: SpendTarget,
  sheet: SpendFields,
  ctx: { cantAct: boolean; bloodied: boolean },
): string | null {
  if (ctx.cantAct && target.part !== "free") {
    return "You can't use an action, bonus, or reaction right now.";
  }
  if (ctx.cantAct && target.moxie > 0) {
    return "Moxie options are off until you can act.";
  }
  if (target.apply === "dig-deep" && !sheet.digDeep) return "Already used.";
  if (target.apply === "dig-deep-exhaustion") {
    if (sheet.digDeep) return "That use is still ready.";
    if (sheet.exhaustion + 1 >= EXHAUSTION_DEATH) return "That would be Exhaustion 6.";
  }
  if (target.apply === "bloodied-unbowed" && !sheet.bloodiedUnbowed)
    return "Already used.";
  if (target.apply === "swagger" && !sheet.swagger) return "Already used.";
  if (target.apply === "guarded-mind" && !sheet.guardedMind) return "Already used.";
  if (target.apply === "down-but-not-out") {
    if (!sheet.downButNotOut) return "Already used.";
    if (!ctx.bloodied) return "Only while bloodied.";
  }
  const cost = target.apply === "swagger" ? Math.max(target.moxie, 1) : target.moxie;
  if ((target.apply === "moxie" || target.apply === "swagger") && sheet.moxie < cost) {
    return cost === 1 ? "Need 1 Moxie." : `Need ${cost} Moxie.`;
  }
  if (!changesSheet(target)) return "Nothing on the sheet changes.";
  return null;
}

/** Apply one legal spend. Brace temp HP is the number already rolled, if any. */
export function applySpend<T extends SpendFields>(
  sheet: T,
  spend: { apply: ActionApply; cost: number; auto?: "brace" | "swagger" },
  ctx: { bloodied: boolean; braceTemp?: number },
): T {
  switch (spend.apply) {
    case "moxie":
      return {
        ...sheet,
        moxie: clamp(sheet.moxie - spend.cost, 0, MOXIE_MAX),
        tempHp:
          spend.auto === "brace" && ctx.braceTemp != null
            ? Math.max(sheet.tempHp, ctx.braceTemp)
            : sheet.tempHp,
      };
    case "bloodied-unbowed":
      return {
        ...sheet,
        moxie: MOXIE_MAX,
        bloodiedUnbowed: false,
        tempHp: ctx.bloodied ? Math.max(sheet.tempHp, 36) : sheet.tempHp,
      };
    case "dig-deep":
      return { ...sheet, digDeep: false, digDeepActive: true };
    case "dig-deep-exhaustion":
      if (sheet.exhaustion + 1 >= EXHAUSTION_DEATH) return sheet;
      return { ...sheet, digDeep: true, exhaustion: sheet.exhaustion + 1 };
    case "swagger":
      return { ...sheet, moxie: clamp(sheet.moxie - 1, 0, MOXIE_MAX) };
    case "guarded-mind":
      return { ...sheet, guardedMind: false };
    case "down-but-not-out":
      return { ...sheet, downButNotOut: false };
    default:
      return sheet;
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
