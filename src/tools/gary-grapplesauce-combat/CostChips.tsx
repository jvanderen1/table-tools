import { cx } from "../../lib/cx";
import { spendChip } from "./cost";

const CHIP =
  "inline-flex h-5 shrink-0 items-center rounded-full border px-1.5 text-[0.62rem] font-semibold tracking-wide tabular-nums";

export function CostChips({ labels }: { labels: string[] }) {
  return (
    <span className="flex shrink-0 flex-wrap items-center gap-1">
      {labels.map((label) => (
        <span
          key={label}
          className={cx(
            CHIP,
            spendChip(label)
              ? "border-gold/40 bg-gold/10 text-gold-soft"
              : "border-line bg-well/80 text-muted",
          )}
        >
          {label}
        </span>
      ))}
    </span>
  );
}
