import { useCallback, useEffect, useState } from "react";

/** Shortest time the dice linger after they land. Stay waits for a tap instead. */
export const DICE_HOLD_MIN = 3;
/** Long enough to read a result; Stay covers anything past this. */
export const DICE_HOLD_MAX = 600;

export type DiceHold = {
  seconds: number;
  stay: boolean;
};

export type DicePrefs = {
  motion: boolean;
  sound: boolean;
  hold: DiceHold;
};

const MOTION_KEY = "table-tools:gary-grapplesauce-combat:dice-motion";
const SOUND_KEY = "table-tools:gary-grapplesauce-combat:dice-sound";
const HOLD_KEY = "table-tools:gary-grapplesauce-combat:dice-hold";

const listeners = new Set<() => void>();

const DEFAULT_HOLD: DiceHold = { seconds: 5, stay: false };
const DEFAULTS: DicePrefs = { motion: true, sound: true, hold: DEFAULT_HOLD };

/** Clamp a typed duration into the allowed range. */
export function clampHoldSeconds(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_HOLD.seconds;
  return Math.min(DICE_HOLD_MAX, Math.max(DICE_HOLD_MIN, Math.round(value)));
}

/**
 * Read a stored duration. Older builds saved `5` or `"stay"`;
 * the current value is `{ seconds, stay }`.
 */
export function parseDiceHold(value: unknown): DiceHold | null {
  if (value === "stay") return { seconds: DEFAULT_HOLD.seconds, stay: true };
  if (typeof value === "number") return { seconds: clampHoldSeconds(value), stay: false };
  if (!value || typeof value !== "object") return null;
  const record = value as { seconds?: unknown; stay?: unknown };
  if (typeof record.seconds !== "number" || typeof record.stay !== "boolean") return null;
  return { seconds: clampHoldSeconds(record.seconds), stay: record.stay };
}

export function readDicePrefs(): DicePrefs {
  return {
    motion: readBool(MOTION_KEY, DEFAULTS.motion),
    sound: readBool(SOUND_KEY, DEFAULTS.sound),
    hold: readHold(HOLD_KEY),
  };
}

export function writeDicePrefs(partial: Partial<DicePrefs>) {
  const next = { ...readDicePrefs(), ...partial };
  writeJson(MOTION_KEY, next.motion);
  writeJson(SOUND_KEY, next.sound);
  writeJson(HOLD_KEY, next.hold);
  listeners.forEach((listener) => listener());
}

/** Shared by the sheet and the Settings panel, so a change applies on the next roll. */
export function useDicePrefs() {
  const [prefs, setPrefs] = useState(readDicePrefs);
  useEffect(() => {
    const refresh = () => setPrefs(readDicePrefs());
    listeners.add(refresh);
    return () => {
      listeners.delete(refresh);
    };
  }, []);
  const update = useCallback((partial: Partial<DicePrefs>) => {
    writeDicePrefs(partial);
  }, []);
  return [prefs, update] as const;
}

function readBool(key: string, fallback: boolean) {
  const value = readJson(key);
  return typeof value === "boolean" ? value : fallback;
}

function readHold(key: string): DiceHold {
  return parseDiceHold(readJson(key)) ?? DEFAULT_HOLD;
}

function readJson(key: string): unknown {
  if (typeof localStorage === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return undefined;
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}
