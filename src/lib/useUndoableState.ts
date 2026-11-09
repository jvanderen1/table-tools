import { useCallback, useEffect, useMemo, useReducer } from "react";

/** One step in the timeline. `state` is what undo (past) or redo (future) restores. */
export type HistoryEntry<T> = {
  id: string;
  at: number;
  label: string;
  /** Changes with the same key inside the coalesce window merge into one step. */
  key: string;
  state: T;
};

export type Change = { label: string; key?: string } | null;

type Store<T> = {
  value: T;
  past: HistoryEntry<T>[];
  future: HistoryEntry<T>[];
};

type Action<T> =
  | { type: "set"; next: T | ((prev: T) => T); at: number; id: string }
  | { type: "undo"; steps: number }
  | { type: "redo"; steps: number }
  | { type: "clear" };

type Options<T> = {
  /** Plain-language summary of prev → next, or null when nothing worth tracking changed. */
  describe: (prev: T, next: T) => Change;
  normalize?: (raw: T) => T;
  max?: number;
  coalesceMs?: number;
};

export type Undoable<T> = {
  value: T;
  set: (next: T | ((prev: T) => T)) => void;
  undo: (steps?: number) => void;
  redo: (steps?: number) => void;
  /** Drop the timeline. The current value stays. */
  clear: () => void;
  past: HistoryEntry<T>[];
  future: HistoryEntry<T>[];
};

function same(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota / private mode
  }
}

/**
 * `usePersistentState` with an undo/redo timeline. The value keeps its usual
 * `table-tools:<key>` slot; the timeline lives in `table-tools:<key>-history`.
 */
export function useUndoableState<T>(
  key: string,
  defaultValue: T,
  { describe, normalize = (v) => v, max = 40, coalesceMs = 600 }: Options<T>,
): Undoable<T> {
  const valueKey = `table-tools:${key}`;
  const historyKey = `${valueKey}-history`;

  const reducer = useCallback(
    (s: Store<T>, a: Action<T>): Store<T> => {
      if (a.type === "set") {
        const next = normalize(
          typeof a.next === "function"
            ? (a.next as (prev: T) => T)(s.value)
            : a.next,
        );
        if (same(next, s.value)) return s;
        const change = describe(s.value, next);
        if (!change) return { ...s, value: next };
        const changeKey = change.key ?? change.label;
        const last = s.past.at(-1);
        if (last && last.key === changeKey && a.at - last.at < coalesceMs) {
          const merged = describe(last.state, next);
          const past = s.past.slice(0, -1);
          return {
            value: next,
            future: [],
            past: merged
              ? [...past, { ...last, at: a.at, label: merged.label }]
              : past,
          };
        }
        return {
          value: next,
          future: [],
          past: [
            ...s.past,
            { id: a.id, at: a.at, label: change.label, key: changeKey, state: s.value },
          ].slice(-max),
        };
      }

      if (a.type === "clear") {
        if (s.past.length === 0 && s.future.length === 0) return s;
        return { value: s.value, past: [], future: [] };
      }

      let { value, past, future } = s;
      if (a.type === "undo") {
        for (let i = 0; i < a.steps && past.length > 0; i++) {
          const entry = past[past.length - 1];
          past = past.slice(0, -1);
          future = [{ ...entry, state: value }, ...future];
          value = normalize(entry.state);
        }
      } else {
        for (let i = 0; i < a.steps && future.length > 0; i++) {
          const [entry, ...rest] = future;
          future = rest;
          past = [...past, { ...entry, state: value }];
          value = normalize(entry.state);
        }
      }
      return { value, past, future };
    },
    [describe, normalize, max, coalesceMs],
  );

  const [store, dispatch] = useReducer(reducer, undefined, (): Store<T> => {
    const history = read<{ past?: HistoryEntry<T>[]; future?: HistoryEntry<T>[] }>(
      historyKey,
      {},
    );
    return {
      value: normalize(read(valueKey, defaultValue)),
      past: history.past ?? [],
      future: history.future ?? [],
    };
  });

  useEffect(() => write(valueKey, store.value), [valueKey, store.value]);
  useEffect(
    () => write(historyKey, { past: store.past, future: store.future }),
    [historyKey, store.past, store.future],
  );

  const set = useCallback((next: T | ((prev: T) => T)) => {
    dispatch({
      type: "set",
      next,
      at: Date.now(),
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    });
  }, []);
  const undo = useCallback((steps = 1) => dispatch({ type: "undo", steps }), []);
  const redo = useCallback((steps = 1) => dispatch({ type: "redo", steps }), []);
  const clear = useCallback(() => dispatch({ type: "clear" }), []);

  return useMemo(
    () => ({
      value: store.value,
      set,
      undo,
      redo,
      clear,
      past: store.past,
      future: store.future,
    }),
    [store, set, undo, redo, clear],
  );
}
