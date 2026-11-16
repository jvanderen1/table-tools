import type { ActionPart, CustomAction, GameAction } from "./actions";

/** Gary's Moxie pool. Matches the five pips on the sheet. */
export const MOXIE_MAX = 5;

export type UsageSheet = {
  moxie: number;
  digDeep: boolean;
  digDeepActive: boolean;
  bloodiedUnbowed: boolean;
  swagger: boolean;
  guardedMind: boolean;
  downButNotOut: boolean;
};

export type CostChip = {
  label: string;
  tone: "plain" | "spend" | "ready" | "spent" | "on";
};

type CostInput = {
  id?: string;
  part: ActionPart | "Action" | "Bonus Action" | "Reaction" | "No action";
  moxie: number;
  apply?: string;
};

/** Turn-economy and resource chips. Never calls a spent action "Free". */
export function costLabels(action: CostInput | GameAction | CustomAction): string[] {
  const economy =
    action.part === "action" || action.part === "Action"
      ? "1 Action"
      : action.part === "bonus" || action.part === "Bonus Action"
        ? "1 Bonus"
        : action.part === "reaction" || action.part === "Reaction"
          ? "1 Reaction"
          : null;
  const labels = economy ? [economy] : [];
  if (action.moxie > 0) labels.push(`${action.moxie} Moxie`);
  if ("apply" in action && action.apply === "dig-deep-exhaustion") {
    labels.push("1 Exhaustion");
  }
  return labels.length > 0 ? labels : ["No action"];
}

const RANK = ["1 Action", "1 Bonus", "1 Reaction", "1 Exhaustion"];

/** One of each cost, with "No action" only when nothing else was spent. */
export function summaryCosts(labels: string[]): string[] {
  const unique = [...new Set(labels)];
  const shown = unique.filter((label) => label !== "No action");
  shown.sort((a, b) => rank(a) - rank(b));
  return shown.length > 0 ? shown : ["No action"];
}

function rank(label: string) {
  const known = RANK.indexOf(label);
  if (known >= 0) return known;
  if (label.endsWith("Moxie")) return 3;
  return 10;
}

export function spendChip(label: string) {
  return label.endsWith("Moxie") || label.endsWith("Exhaustion");
}

/**
 * What is left of a limited use.
 * Long rest: Dig Deep, Down But Not Out.
 * Short rest: Bloodied, Swagger, Guarded Mind. Moxie refills then too.
 */
export function usageChip(action: CostInput, sheet: UsageSheet): CostChip | null {
  const apply = "apply" in action ? action.apply : undefined;
  const id = action.id;
  if (apply === "dig-deep-exhaustion" || id === "dig-deep-again") {
    return sheet.digDeep
      ? { label: "1/1 long", tone: "ready" }
      : { label: "0/1 long", tone: "spent" };
  }
  if (apply === "dig-deep" || id === "dig-deep") {
    if (sheet.digDeepActive && sheet.digDeep) return { label: "On · 1 left", tone: "on" };
    if (sheet.digDeepActive) return { label: "On", tone: "on" };
    return sheet.digDeep
      ? { label: "1/1 long", tone: "ready" }
      : { label: "0/1 long", tone: "spent" };
  }
  if (apply === "bloodied-unbowed" || id === "bloodied") {
    return flagChip(sheet.bloodiedUnbowed, "short");
  }
  if (apply === "swagger" || id === "swagger") return flagChip(sheet.swagger, "short");
  if (apply === "guarded-mind" || id === "guarded-mind") {
    return flagChip(sheet.guardedMind, "short");
  }
  if (apply === "down-but-not-out" || id === "down-but-not-out") {
    return flagChip(sheet.downButNotOut, "long");
  }
  if (action.moxie > 0) {
    const left = Math.max(0, Math.min(MOXIE_MAX, sheet.moxie));
    return {
      label: `${left}/${MOXIE_MAX}`,
      tone: left >= action.moxie ? "ready" : "spent",
    };
  }
  return null;
}

function flagChip(ready: boolean, rest: "short" | "long"): CostChip {
  return ready
    ? { label: `1/1 ${rest}`, tone: "ready" }
    : { label: `0/1 ${rest}`, tone: "spent" };
}

/** Price chips, plus the live use when the sheet is known. */
export function actionChips(
  action: CostInput | GameAction | CustomAction,
  sheet?: UsageSheet,
): CostChip[] {
  const chips: CostChip[] = costLabels(action).map((label) => ({
    label,
    tone: spendChip(label) ? "spend" : "plain",
  }));
  if (!sheet) return chips;
  const use = usageChip(action, sheet);
  return use ? [...chips, use] : chips;
}
