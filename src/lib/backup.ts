const PREFIX = "table-tools:";
const LAST_BACKUP_KEY = "table-tools-meta:last-backup";

type BackupFile = {
  app: "table-tools";
  version: 1;
  exportedAt: string;
  data: Record<string, string>;
};

/** Ask the browser not to evict localStorage under storage pressure or inactivity. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function isStoragePersisted(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persisted) return null;
    return await navigator.storage.persisted();
  } catch {
    return null;
  }
}

export function savedKeys(): string[] {
  return Object.keys(localStorage)
    .filter((k) => k.startsWith(PREFIX))
    .sort();
}

export function createBackup(): string {
  const data: Record<string, string> = {};
  for (const key of savedKeys()) {
    const value = localStorage.getItem(key);
    if (value != null) data[key] = value;
  }
  const file: BackupFile = {
    app: "table-tools",
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };
  return JSON.stringify(file, null, 2);
}

export function backupFileName() {
  return `table-tools-backup-${new Date().toISOString().slice(0, 10)}.json`;
}

export function markBackedUp() {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
  } catch {
    // ignore
  }
}

export function lastBackupAt(): Date | null {
  const raw = localStorage.getItem(LAST_BACKUP_KEY);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Validates without writing anything. */
export function parseBackup(text: string): BackupFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That isn’t valid backup text.");
  }
  const file = parsed as Partial<BackupFile>;
  if (
    !file ||
    file.app !== "table-tools" ||
    typeof file.data !== "object" ||
    file.data === null
  ) {
    throw new Error("That isn’t a Table Tools backup.");
  }
  for (const [key, value] of Object.entries(file.data)) {
    if (!key.startsWith(PREFIX) || typeof value !== "string") {
      throw new Error(`Unexpected entry in backup: ${key}`);
    }
  }
  return file as BackupFile;
}

/** Replaces every saved table-tools entry with the backup's contents. */
export function restoreBackup(file: BackupFile) {
  for (const key of savedKeys()) localStorage.removeItem(key);
  for (const [key, value] of Object.entries(file.data)) {
    localStorage.setItem(key, value);
  }
}
