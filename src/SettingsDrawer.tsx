import { useState } from "react";
import { Minus, Plus, SlidersHorizontal } from "lucide-react";
import {
  DICE_HOLD_MAX,
  DICE_HOLD_MIN,
  clampHoldSeconds,
  readDicePrefs,
  useDicePrefs,
} from "./lib/dicePrefs";
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
  const [draft, setDraft] = useState<string | null>(null);
  const toggle =
    "flex h-14 cursor-pointer flex-col items-center justify-center rounded-lg border text-sm font-medium leading-tight";
  const on = "border-gold/80 bg-gold/15 text-gold-soft";
  const off = "border-line bg-well/70 text-ink hover:border-gold/50";
  const step =
    "grid size-11 shrink-0 cursor-pointer place-items-center rounded-lg border border-line bg-well/70 text-ink hover:border-gold/50 disabled:cursor-not-allowed disabled:opacity-40";
  const seconds = typedSeconds(draft, prefs.hold.seconds);

  function commit(raw: string) {
    const parsed = Number(raw);
    update({
      hold: {
        seconds: Number.isFinite(parsed) ? clampHoldSeconds(parsed) : prefs.hold.seconds,
        stay: prefs.hold.stay,
      },
    });
    setDraft(null);
  }

  function nudge(delta: number) {
    update({
      hold: { seconds: clampHoldSeconds(seconds + delta), stay: prefs.hold.stay },
    });
    setDraft(null);
  }

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
        <div className="flex h-11 items-center gap-2">
          <button
            type="button"
            className={step}
            aria-label="One second shorter"
            disabled={seconds <= DICE_HOLD_MIN}
            onClick={() => nudge(-1)}
          >
            <Minus className="size-4" aria-hidden />
          </button>
          <label className="flex h-11 min-w-0 flex-1 items-center justify-center gap-1 rounded-lg border border-line bg-well/70 px-2">
            <input
              className="w-14 bg-transparent text-center text-sm font-medium tabular-nums outline-none"
              inputMode="numeric"
              aria-label="Seconds the dice stay"
              value={draft ?? String(prefs.hold.seconds)}
              onChange={(event) => {
                const raw = event.target.value.replace(/[^\d]/g, "");
                setDraft(raw);
                const parsed = Number(raw);
                if (raw !== "" && parsed >= DICE_HOLD_MIN) {
                  update({
                    hold: { seconds: clampHoldSeconds(parsed), stay: prefs.hold.stay },
                  });
                }
              }}
              onBlur={(event) => commit(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
            />
            <span className="text-sm text-muted">s</span>
          </label>
          <button
            type="button"
            className={step}
            aria-label="One second longer"
            disabled={seconds >= DICE_HOLD_MAX}
            onClick={() => nudge(1)}
          >
            <Plus className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            className={cx(
              "h-11 w-16 shrink-0 cursor-pointer rounded-lg border text-sm font-medium",
              prefs.hold.stay ? on : off,
            )}
            aria-pressed={prefs.hold.stay}
            aria-label={
              prefs.hold.stay ? "Dice stay until dismissed" : "Keep dice until dismissed"
            }
            onClick={() => {
              const current = readDicePrefs().hold;
              const parsed =
                draft == null || draft === "" ? current.seconds : Number(draft);
              update({
                hold: {
                  seconds: Number.isFinite(parsed)
                    ? clampHoldSeconds(parsed)
                    : current.seconds,
                  stay: !current.stay,
                },
              });
              setDraft(null);
            }}
          >
            Stay
          </button>
        </div>
      </div>
      <Text tone="tertiary">
        At least 3 seconds after they land, or Stay until you tap. Tap anywhere to clear
        them. Escape does the same.
      </Text>
    </Stack>
  );
}

function typedSeconds(draft: string | null, saved: number) {
  if (draft == null || draft === "") return saved;
  const parsed = Number(draft);
  return Number.isFinite(parsed) ? parsed : saved;
}
