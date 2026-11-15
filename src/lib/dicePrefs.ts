import { useCallback, useEffect, useState } from "react";

/** How many seconds the dice stay. "stay" waits until they are tapped away. */
export const DICE_HOLD_CHOICES = [3, 5, 8] as const;
export type DiceHold = (typeof DICE_HOLD_CHOICES)[number] | "stay";

export type DicePrefs = {
  motion: boolean;
  sound: boolean;
  hold: DiceHold;
};

const MOTION_KEY = "table-tools:gary-grapplesauce-combat:dice-motion";
const SOUND_KEY = "table-tools:gary-grapplesauce-combat:dice-sound";
const HOLD_KEY = "table-tools:gary-grapplesauce-combat:dice-hold";

const listeners = new Set<() => void>();

export function isDiceHold(value: unknown): value is DiceHold {
  return value === "stay" || value === 3 || value === 5 || value === 8;
}

const DEFAULTS: DicePrefs = { motion: true, sound: true, hold: 5 };

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
  const value = readJson(key);
  return isDiceHold(value) ? value : DEFAULTS.hold;
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
