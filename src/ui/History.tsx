import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { History, Redo2, RotateCcw, Trash2, Undo2 } from "lucide-react";
import { cx } from "../lib/cx";
import { clockTime, timeAgo, useNow } from "../lib/time";
import { Button, Drawer, Stack, Text } from "./index";

type Step = { id: string; at: number; label: string };

/** Anything with an undo timeline (see `useUndoableState`). */
export type Timeline = {
  past: Step[];
  future: Step[];
  undo: (steps?: number) => void;
  redo: (steps?: number) => void;
  clear: () => void;
};

export type Track = { name: string; timeline: Timeline };

type TaggedStep = Step & { track: Track };

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return (
    !!el &&
    (el.tagName === "INPUT" ||
      el.tagName === "TEXTAREA" ||
      el.tagName === "SELECT" ||
      el.isContentEditable)
  );
}

/**
 * Floating Undo / Redo / History control. Merges several timelines (e.g. sheet
 * and inventory) into one, ordered by when each change happened.
 */
export function UndoBar({
  tracks,
  onTravel,
}: {
  tracks: Track[];
  /** Called after any undo/redo, e.g. to re-enable an "Apply" button. */
  onTravel?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const past: TaggedStep[] = tracks
    .flatMap((track) => track.timeline.past.map((e) => ({ ...e, track })))
    .sort((a, b) => b.at - a.at);
  const future: TaggedStep[] = tracks
    .flatMap((track) => track.timeline.future.map((e) => ({ ...e, track })))
    .sort((a, b) => a.at - b.at);
  const showTrack = tracks.length > 1;

  function announce(text: string) {
    window.clearTimeout(timer.current);
    setToast({ id: Date.now(), text });
    timer.current = window.setTimeout(() => setToast(null), 2600);
  }

  function undoLatest() {
    const step = past[0];
    if (!step) return;
    step.track.timeline.undo(1);
    onTravel?.();
    announce(`Undid: ${step.label}`);
  }

  function redoNext() {
    const step = future[0];
    if (!step) return;
    step.track.timeline.redo(1);
    onTravel?.();
    announce(`Redid: ${step.label}`);
  }

  function goBackTo(step: TaggedStep) {
    let count = 0;
    for (const track of tracks) {
      const steps = track.timeline.past.filter((e) => e.at >= step.at).length;
      if (steps > 0) track.timeline.undo(steps);
      count += steps;
    }
    onTravel?.();
    announce(`Went back ${count} ${count === 1 ? "step" : "steps"}`);
  }

  function clearHistory() {
    if (past.length === 0 && future.length === 0) return;
    for (const track of tracks) track.timeline.clear();
    announce("History cleared. Current numbers stay.");
  }

  function redoTo(step: TaggedStep) {
    let count = 0;
    for (const track of tracks) {
      const steps = track.timeline.future.filter((e) => e.at <= step.at).length;
      if (steps > 0) track.timeline.redo(steps);
      count += steps;
    }
    onTravel?.();
    announce(`Redid ${count} ${count === 1 ? "step" : "steps"}`);
  }

  const undoRef = useRef(undoLatest);
  const redoRef = useRef(redoNext);
  useEffect(() => {
    undoRef.current = undoLatest;
    redoRef.current = redoNext;
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || isTyping(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        undoRef.current();
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        redoRef.current();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(timer.current);
    };
  }, []);

  const now = useNow(open);
  const PILL_BTN =
    "inline-flex h-full cursor-pointer items-center gap-1.5 px-3 text-sm font-medium text-ink transition-colors hover:bg-raised/70 hover:text-gold-soft disabled:cursor-not-allowed disabled:text-faint disabled:hover:bg-transparent";

  return (
    <>
      {createPortal(
        <div className="pointer-events-none fixed bottom-3 left-3 z-30 flex flex-col items-start gap-2">
          {toast ? (
            <div
              key={toast.id}
              role="status"
              className="pointer-events-auto max-w-[min(18rem,calc(100vw-7rem))] animate-pop-in truncate rounded-lg border border-gold/40 bg-surface px-3 py-2 text-[0.8rem] text-gold-soft shadow-[0_12px_28px_-8px_rgba(0,0,0,0.85)]"
            >
              {toast.text}
            </div>
          ) : null}
          <div className="pointer-events-auto flex h-12 items-stretch divide-x divide-line overflow-hidden rounded-full border border-line bg-surface/95 shadow-[0_12px_28px_-8px_rgba(0,0,0,0.85)] backdrop-blur">
            <button
              type="button"
              className={cx(PILL_BTN, "pl-4")}
              disabled={past.length === 0}
              title={past[0] ? `Undo: ${past[0].label}` : "Nothing to undo"}
              onClick={undoLatest}
            >
              <Undo2 className="size-4" aria-hidden />
              Undo
            </button>
            <button
              type="button"
              className={PILL_BTN}
              disabled={future.length === 0}
              aria-label={future[0] ? `Redo: ${future[0].label}` : "Nothing to redo"}
              title={future[0] ? `Redo: ${future[0].label}` : "Nothing to redo"}
              onClick={redoNext}
            >
              <Redo2 className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              className={cx(PILL_BTN, "pr-4")}
              aria-label="History"
              title="History"
              onClick={() => setOpen(true)}
            >
              <History className="size-4" aria-hidden />
            </button>
          </div>
        </div>,
        document.body,
      )}

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="History"
        icon={History}
      >
        <Stack gap={14}>
          <Text tone="secondary">
            Every change is kept here. Go back to undo a change and everything
            after it; you can always redo. Shortcut: ⌘Z / ⇧⌘Z.
          </Text>

          {future.length > 0 ? (
            <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
              {[...future].reverse().map((step) => (
                <li
                  key={step.id}
                  className="flex min-h-12 items-center gap-2 rounded-lg border border-dashed border-line px-3 py-1.5 text-faint"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm line-through decoration-faint/50">
                      {step.label}
                    </div>
                    <div className="text-xs">
                      Undone{showTrack ? ` · ${step.track.name}` : ""} ·{" "}
                      <time title={clockTime(step.at)}>{timeAgo(step.at, now)}</time>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" icon={Redo2} onClick={() => redoTo(step)}>
                    Redo
                  </Button>
                </li>
              ))}
            </ol>
          ) : null}

          <div className="flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-gold-soft">
            <span className="h-px flex-1 bg-gold/40" />
            Now
            <span className="h-px flex-1 bg-gold/40" />
          </div>

          {past.length === 0 ? (
            <Text tone="tertiary">No changes yet.</Text>
          ) : (
            <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
              {past.map((step, i) => (
                <li
                  key={step.id}
                  className="flex min-h-12 items-center gap-2 rounded-lg border border-line bg-well/60 px-3 py-1.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-ink">{step.label}</div>
                    <div className="text-xs text-faint">
                      {showTrack ? `${step.track.name} · ` : ""}
                      <time title={clockTime(step.at)}>{timeAgo(step.at, now)}</time>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={i === 0 ? Undo2 : RotateCcw}
                    onClick={() => goBackTo(step)}
                  >
                    {i === 0 ? "Undo" : "Go back"}
                  </Button>
                </li>
              ))}
            </ol>
          )}

          <Button
            variant="ghost"
            size="sm"
            icon={Trash2}
            disabled={past.length === 0 && future.length === 0}
            onClick={clearHistory}
          >
            Clear history
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}
