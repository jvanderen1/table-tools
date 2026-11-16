import { cx } from "../../lib/cx";
import { spendChip, type CostChip } from "./cost";

const CHIP =
  "inline-flex h-5 shrink-0 items-center rounded-full border px-1.5 text-[0.62rem] font-semibold tracking-wide tabular-nums";

const TONE = {
  plain: "border-line bg-well/80 text-muted",
  spend: "border-gold/40 bg-gold/10 text-gold-soft",
  ready: "border-verdant/40 bg-verdant/10 text-verdant",
  spent: "border-line bg-well/50 text-faint",
  on: "border-verdant/50 bg-verdant/15 text-verdant",
} as const;

export function CostChips({ labels }: { labels: Array<string | CostChip> }) {
  const chips = labels.map((item) =>
    typeof item === "string"
      ? { label: item, tone: spendChip(item) ? ("spend" as const) : ("plain" as const) }
      : item,
  );
  return (
    <span className="flex shrink-0 flex-nowrap items-center gap-1">
      {chips.map((chip) => (
        <span key={chip.label} className={cx(CHIP, TONE[chip.tone])}>
          {chip.label}
        </span>
      ))}
    </span>
  );
}
