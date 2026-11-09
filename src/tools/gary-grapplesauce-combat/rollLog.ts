import { createContext, useContext } from "react";

export type RollFlag = "crit" | "miss" | "fail";

export type RollLogEntry = {
  id: string;
  at: number;
  /** What was rolled, e.g. "Athletics" or "Unarmed damage" */
  label: string;
  /** Dice notation, e.g. "1d20 + 13" */
  expression: string;
  /** Faces rolled, e.g. "d20 (14) + 13" */
  breakdown: string;
  total: number;
  /** Shown instead of the total, e.g. "Fail" or "Miss" */
  result?: string;
  flag?: RollFlag;
};

export type NewRoll = Omit<RollLogEntry, "id" | "at">;

export const ROLL_LOG_MAX = 50;

export type RollLogApi = {
  log: RollLogEntry[];
  record: (roll: NewRoll) => void;
  clear: () => void;
  /** Next damage roll doubles its dice. Set by natural 20s, cleared by damage. */
  crit: boolean;
  setCrit: (next: boolean) => void;
};

export const RollLogContext = createContext<RollLogApi | null>(null);

export function useRollLog(): RollLogApi {
  const api = useContext(RollLogContext);
  if (!api) throw new Error("useRollLog must be used inside RollLogContext");
  return api;
}

export function rollId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
