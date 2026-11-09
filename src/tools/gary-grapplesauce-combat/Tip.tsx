import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { BookOpen, ChevronDown, ExternalLink, Info, X } from "lucide-react";
import { cx } from "../../lib/cx";
import { GLOSSARY } from "./glossary";

const BUBBLE_WIDTH = 320;
const GAP = 6;

export function Tip({
  id,
  children,
  fill = false,
  icon = true,
}: {
  id: keyof typeof GLOSSARY;
  children: ReactNode;
  /** Stretch to the parent's width and truncate the label (grid cells). */
  fill?: boolean;
  /** Show the ⓘ marker; drop it where the whole tile is obviously tappable. */
  icon?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const entry = GLOSSARY[id];

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = Math.min(BUBBLE_WIDTH, window.innerWidth - 16);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    setPos({ top: rect.bottom + GAP, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function close(e: Event) {
      const target = e.target as Node | null;
      if (
        target &&
        (triggerRef.current?.contains(target) || bubbleRef.current?.contains(target))
      ) {
        return;
      }
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onScroll() {
      setOpen(false);
    }
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  if (!entry) return <>{children}</>;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={cx(
          "group/tip inline-flex cursor-help items-center gap-1.5 rounded border-0 bg-transparent p-0 text-left text-[inherit]",
          fill && "h-full w-full min-w-0 justify-between",
        )}
        aria-expanded={open}
        aria-label={`${entry.label} — show rules`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <span className={cx(fill && "min-w-0 truncate")}>{children}</span>
        {icon ? (
          <Info
            className={cx(
              "size-3.5 shrink-0 transition-colors",
              open ? "text-gold" : "text-faint group-hover/tip:text-gold",
            )}
            aria-hidden
          />
        ) : null}
      </button>
      {open && pos
        ? createPortal(
            <div
              ref={bubbleRef}
              className="fixed z-[1000] flex animate-pop-in flex-col gap-2 rounded-xl border border-gold/35 bg-surface px-3.5 py-3 text-ink shadow-[0_18px_40px_-12px_rgba(0,0,0,0.85)]"
              role="dialog"
              aria-label={entry.label}
              style={{
                top: pos.top,
                left: pos.left,
                width: Math.min(BUBBLE_WIDTH, window.innerWidth - 16),
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <strong className="font-display text-sm tracking-[0.06em] text-gold-soft">
                  {entry.label}
                </strong>
                <button
                  type="button"
                  aria-label="Close"
                  className="grid size-7 cursor-pointer place-items-center rounded-md text-muted hover:bg-raised hover:text-ink"
                  onClick={() => setOpen(false)}
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
              <div className="text-[0.9rem] leading-snug text-ink/90">
                {entry.summary}
              </div>
              <SourceLine source={entry.source} href={entry.href} />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export function SourceLine({ source, href }: { source?: string; href?: string }) {
  if (!source) return null;
  if (!href) return <div className="text-xs text-faint">{source}</div>;
  return (
    <a
      className="inline-flex w-fit items-center gap-1 text-xs text-gold-soft"
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      <BookOpen className="size-3.5" aria-hidden />
      {source}
      <ExternalLink className="size-3" aria-hidden />
    </a>
  );
}

export function GlossaryItem({
  label,
  summary,
  source,
  href,
}: {
  label: string;
  summary: string;
  source?: string;
  href?: string;
}) {
  return (
    <details className="group rounded-lg border border-line bg-well/60">
      <summary className="flex min-h-10 cursor-pointer items-center gap-2 px-3 text-[0.92rem] font-medium hover:text-gold-soft">
        <span className="flex-1">{label}</span>
        <ChevronDown
          className="size-4 text-faint transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="flex flex-col gap-2 border-t border-line px-3 py-2.5">
        <p className="m-0 text-[0.9rem] leading-snug text-ink/90">{summary}</p>
        <SourceLine source={source} href={href} />
      </div>
    </details>
  );
}

export function GlossaryList({ kind = "feature" }: { kind?: "feature" | "condition" }) {
  const entries = Object.values(GLOSSARY).filter((e) => e.kind === kind);
  return (
    <div className="flex flex-col gap-1.5">
      {entries.map((entry) => (
        <GlossaryItem
          key={entry.id}
          label={entry.label}
          summary={entry.summary}
          source={entry.source}
          href={entry.href}
        />
      ))}
    </div>
  );
}
