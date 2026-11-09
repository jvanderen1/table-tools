import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ClipboardCopy,
  ClipboardPaste,
  DatabaseBackup,
  Download,
  FileUp,
  ShieldCheck,
  ShieldQuestion,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  backupFileName,
  createBackup,
  isStoragePersisted,
  lastBackupAt,
  markBackedUp,
  parseBackup,
  requestPersistentStorage,
  restoreBackup,
  savedKeys,
} from "./lib/backup";
import { Button, Callout, Divider, Drawer, Stack, Text } from "./ui";

type Notice = { tone: "info" | "warning"; title: string; detail: string };

export function BackupDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Drawer open={open} onClose={onClose} title="Backup & restore" icon={DatabaseBackup}>
      <BackupPanel />
    </Drawer>
  );
}

function BackupPanel() {
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [lastBackup, setLastBackup] = useState(lastBackupAt);
  const [pasted, setPasted] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void isStoragePersisted().then(setPersisted);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function protect() {
    const ok = await requestPersistentStorage();
    setPersisted(ok);
    if (!ok) {
      setNotice({
        tone: "warning",
        title: "The browser said no",
        detail:
          "Safari and Chrome only grant this to installed or frequently used apps. Opening the app from your Home Screen covers it; keep a backup file either way.",
      });
    }
  }

  function backedUp() {
    markBackedUp();
    setLastBackup(lastBackupAt());
  }

  async function saveFile() {
    const text = createBackup();
    const name = backupFileName();
    const file = new File([text], name, { type: "application/json" });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: name });
        backedUp();
        return;
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    backedUp();
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(createBackup());
      backedUp();
      setNotice({
        tone: "info",
        title: "Backup copied",
        detail: "Paste it into Notes or a message to yourself.",
      });
    } catch {
      setNotice({
        tone: "warning",
        title: "Couldn’t copy",
        detail: "The browser blocked the clipboard. Use Save backup file instead.",
      });
    }
  }

  function restore(text: string) {
    try {
      const file = parseBackup(text);
      const count = Object.keys(file.data).length;
      const when = new Date(file.exportedAt).toLocaleString();
      if (
        !window.confirm(
          `Replace everything saved on this device with the backup from ${when} (${count} items)?`,
        )
      ) {
        return;
      }
      restoreBackup(file);
      window.location.reload();
    } catch (err) {
      setNotice({
        tone: "warning",
        title: "Restore failed",
        detail: (err as Error).message,
      });
    }
  }

  async function restoreFromFile(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    restore(await file.text());
    if (fileRef.current) fileRef.current.value = "";
  }

  const count = savedKeys().length;

  return (
    <Stack gap={16}>
      <Text tone="secondary">
        Everything (HP, Moxie, conditions, settings) lives only in this browser. A backup
        file lets you recover it on a new phone or after the browser clears data.
      </Text>

      <div className="flex items-start gap-3 rounded-xl border border-line bg-well/60 px-3.5 py-3">
        {persisted ? (
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-verdant" aria-hidden />
        ) : (
          <ShieldQuestion className="mt-0.5 size-5 shrink-0 text-gold" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <div className="font-semibold">
            {persisted
              ? "Storage is protected"
              : persisted === false
                ? "Storage isn’t protected yet"
                : "Storage protection unknown"}
          </div>
          <Text tone="tertiary">
            {persisted
              ? "The browser promised not to clear it on its own."
              : "The browser may clear it if space runs low or the app goes unused."}
          </Text>
          <Button
            size="sm"
            variant="secondary"
            icon={ShieldCheck}
            className="mt-2"
            disabled={persisted === true}
            onClick={protect}
          >
            {persisted ? "Protected" : "Protect storage"}
          </Button>
        </div>
      </div>

      <Stack gap={8}>
        <Text tone="tertiary">
          {count} saved {count === 1 ? "item" : "items"} ·{" "}
          {lastBackup ? `last backup ${lastBackup.toLocaleString()}` : "never backed up"}
        </Text>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="primary" icon={Download} onClick={saveFile}>
            Save backup file
          </Button>
          <Button variant="secondary" icon={ClipboardCopy} onClick={copyText}>
            Copy as text
          </Button>
        </div>
      </Stack>

      {notice
        ? createPortal(
            <div
              className="fixed inset-x-3 bottom-3 z-[60] animate-pop-in sm:left-auto sm:w-[24rem]"
              role="status"
            >
              <Callout
                tone={notice.tone}
                title={notice.title}
                icon={notice.tone === "warning" ? TriangleAlert : ClipboardCopy}
                className="bg-surface pr-10 shadow-2xl"
              >
                {notice.detail}
              </Callout>
              <button
                type="button"
                aria-label="Dismiss"
                className="absolute top-2 right-2 grid size-7 cursor-pointer place-items-center rounded-md text-muted hover:text-ink"
                onClick={() => setNotice(null)}
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>,
            document.body,
          )
        : null}

      <Divider />

      <Stack gap={8}>
        <div className="font-display text-sm font-semibold tracking-[0.08em] text-gold-soft">
          Restore
        </div>
        <Text tone="tertiary">
          Restoring replaces what’s on this device, then reloads.
        </Text>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => void restoreFromFile(e.target.files)}
        />
        <Button
          variant="secondary"
          icon={FileUp}
          onClick={() => fileRef.current?.click()}
        >
          Restore from file
        </Button>
        <textarea
          className="min-h-24 w-full rounded-lg border border-line bg-well px-3 py-2 font-mono text-xs text-ink outline-none focus:border-gold/70"
          placeholder="…or paste backup text here"
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
        />
        <Button
          variant="secondary"
          icon={ClipboardPaste}
          disabled={pasted.trim() === ""}
          onClick={() => restore(pasted)}
        >
          Restore pasted text
        </Button>
      </Stack>
    </Stack>
  );
}
