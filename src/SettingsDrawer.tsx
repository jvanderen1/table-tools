import { SlidersHorizontal } from "lucide-react";
import { DICE_HOLD_CHOICES, useDicePrefs } from "./lib/dicePrefs";
import { cx } from "./lib/cx";
import { Drawer, Stack, Text } from "./ui";

export function SettingsDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Drawer open={open} onClose={onClose} title="Settings" icon={SlidersHorizontal}>
      <DiceSettings />
    </Drawer>
  );
}

function DiceSettings() {
  const [prefs, update] = useDicePrefs();
  const toggle =
    "flex h-14 cursor-pointer flex-col items-center justify-center rounded-lg border text-sm font-medium leading-tight";
  const choice =
    "flex h-11 cursor-pointer items-center justify-center rounded-lg border text-sm font-medium tabular-nums";
  const on = "border-gold/80 bg-gold/15 text-gold-soft";
  const off = "border-line bg-well/70 text-ink hover:border-gold/50";
  return (
    <Stack gap={14}>
      <Text tone="secondary">
        Dice thrown for every roll. The tray itself only builds the pool.
      </Text>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className={cx(toggle, prefs.motion ? on : off)}
          aria-pressed={prefs.motion}
          aria-label={prefs.motion ? "Show dice on" : "Show dice off"}
          onClick={() => update({ motion: !prefs.motion })}
        >
          Show dice
          <span className="text-xs font-semibold">{prefs.motion ? "On" : "Off"}</span>
        </button>
        <button
          type="button"
          className={cx(toggle, prefs.sound ? on : off)}
          aria-pressed={prefs.sound}
          aria-label={prefs.sound ? "Dice sound on" : "Dice sound off"}
          onClick={() => update({ sound: !prefs.sound })}
        >
          Sound
          <span className="text-xs font-semibold">{prefs.sound ? "On" : "Off"}</span>
        </button>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[0.72rem] font-semibold tracking-[0.12em] text-muted uppercase">
          How long they stay
        </span>
        <div className="grid h-11 grid-cols-4 gap-2">
          {DICE_HOLD_CHOICES.map((seconds) => (
            <HoldButton
              key={seconds}
              className={choice}
              pressed={prefs.hold === seconds}
              on={on}
              off={off}
              label={`${seconds}s`}
              ariaLabel={`Keep dice for ${seconds} seconds`}
              onClick={() => update({ hold: seconds })}
            />
          ))}
          <HoldButton
            className={choice}
            pressed={prefs.hold === "stay"}
            on={on}
            off={off}
            label="Stay"
            ariaLabel="Keep dice until dismissed"
            onClick={() => update({ hold: "stay" })}
          />
        </div>
      </div>
      <Text tone="tertiary">
        Tap a die or the total to clear them sooner. Escape does the same.
      </Text>
    </Stack>
  );
}

function HoldButton({
  className,
  pressed,
  on,
  off,
  label,
  ariaLabel,
  onClick,
}: {
  className: string;
  pressed: boolean;
  on: string;
  off: string;
  label: string;
  ariaLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cx(className, pressed ? on : off)}
      aria-pressed={pressed}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
