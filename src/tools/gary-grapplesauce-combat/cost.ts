import type { ActionPart, CustomAction, GameAction } from "./actions";

type CostInput = {
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
