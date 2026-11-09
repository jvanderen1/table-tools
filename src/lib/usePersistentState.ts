import { useEffect, useState } from "react";

/** localStorage-backed state that survives refresh (phone-friendly at the table). */
export function usePersistentState<T>(key: string, defaultValue: T) {
  const storageKey = `table-tools:${key}`;
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw == null) return defaultValue;
      return JSON.parse(raw) as T;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // ignore quota / private mode
    }
  }, [storageKey, value]);

  return [value, setValue] as const;
}
