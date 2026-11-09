import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { GLOSSARY } from "./glossary";

const BUBBLE_WIDTH = 320;
const GAP = 6;

export function Tip({
  id,
  children,
}: {
  id: keyof typeof GLOSSARY;
  children: ReactNode;
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
    const left = Math.max(
      8,
      Math.min(rect.left, window.innerWidth - width - 8),
    );
    setPos({ top: rect.bottom + GAP, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function close(e: Event) {
      const target = e.target as Node | null;
      if (
        target &&
        (triggerRef.current?.contains(target) ||
          bubbleRef.current?.contains(target))
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
        className={`tip-trigger${open ? " open" : ""}`}
        aria-expanded={open}
        aria-label={`${entry.label} — show rules`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <span>{children}</span>
        <span className="tip-mark" aria-hidden="true">
          ?
        </span>
      </button>
      {open && pos
        ? createPortal(
            <div
              ref={bubbleRef}
              className="tip-bubble"
              role="dialog"
              aria-label={entry.label}
              style={{
                top: pos.top,
                left: pos.left,
                width: Math.min(BUBBLE_WIDTH, window.innerWidth - 16),
              }}
            >
              <div className="tip-bubble-head">
                <strong>{entry.label}</strong>
                <button
                  type="button"
                  className="tip-close"
                  onClick={() => setOpen(false)}
                >
                  Close
                </button>
              </div>
              <div className="tip-bubble-body">{entry.summary}</div>
              <SourceLine source={entry.source} href={entry.href} />

            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export function SourceLine({
  source,
  href,
}: {
  source?: string;
  href?: string;
}) {
  if (!source) return null;
  if (!href) return <div className="tip-source">{source}</div>;
  return (
    <a
      className="tip-source tip-source-link"
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      {source} ↗
    </a>
  );
}

export function GlossaryList({
  kind = "feature",
}: {
  kind?: "feature" | "condition";
}) {
  const entries = Object.values(GLOSSARY).filter((e) => e.kind === kind);
  return (
    <div className="glossary-list">
      {entries.map((entry) => (
        <details key={entry.id} className="glossary-item">
          <summary>{entry.label}</summary>
          <p>{entry.summary}</p>
          <SourceLine source={entry.source} href={entry.href} />
        </details>
      ))}
    </div>
  );
}
