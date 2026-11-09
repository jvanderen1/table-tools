import { useState, type ReactNode } from "react";
import { GLOSSARY, type GlossaryEntry } from "./glossary";

export function Tip({
  id,
  children,
}: {
  id: keyof typeof GLOSSARY;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const entry = GLOSSARY[id];
  if (!entry) return <>{children}</>;

  return (
    <span className={`tip${open ? " open" : ""}`}>
      <button
        type="button"
        className="tip-trigger"
        aria-expanded={open}
        title={`${entry.label}: ${entry.summary}`}
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
      {open ? <TipBubble entry={entry} onClose={() => setOpen(false)} /> : null}
    </span>
  );
}

function TipBubble({
  entry,
  onClose,
}: {
  entry: GlossaryEntry;
  onClose: () => void;
}) {
  return (
    <span className="tip-bubble" role="note">
      <span className="tip-bubble-head">
        <strong>{entry.label}</strong>
        <button type="button" className="tip-close" onClick={onClose}>
          Close
        </button>
      </span>
      <span className="tip-bubble-body">{entry.summary}</span>
      {entry.source ? (
        <span className="tip-source">{entry.source}</span>
      ) : null}
    </span>
  );
}

export function GlossaryList() {
  const entries = Object.values(GLOSSARY);
  return (
    <div className="glossary-list">
      {entries.map((entry) => (
        <details key={entry.id} className="glossary-item">
          <summary>{entry.label}</summary>
          <p>{entry.summary}</p>
          {entry.source ? <p className="tip-source">{entry.source}</p> : null}
        </details>
      ))}
    </div>
  );
}
