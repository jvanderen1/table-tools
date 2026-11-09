import {
  useEffect,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X, type LucideIcon } from "lucide-react";
import { cx } from "../lib/cx";

export function Stack({
  children,
  gap = 12,
  style,
  className,
}: {
  children: ReactNode;
  gap?: number;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col", className)} style={{ gap, ...style }}>
      {children}
    </div>
  );
}

export function Row({
  children,
  gap = 8,
  wrap = false,
  align = "center",
  style,
  className,
}: {
  children: ReactNode;
  gap?: number;
  wrap?: boolean;
  align?: CSSProperties["alignItems"];
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={cx("flex flex-row", wrap && "flex-wrap", className)}
      style={{ gap, alignItems: align, ...style }}
    >
      {children}
    </div>
  );
}

export function Grid({
  children,
  columns = 1,
  gap = 12,
}: {
  children: ReactNode;
  columns?: 1 | 3;
  gap?: number;
}) {
  return (
    <div
      className={cx(
        "grid grid-cols-1",
        columns === 3 && "sm:grid-cols-3",
      )}
      style={{ gap }}
    >
      {children}
    </div>
  );
}

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        "overflow-hidden rounded-xl border border-line bg-surface/85 shadow-[0_1px_0_0_rgba(197,160,89,0.06)_inset,0_12px_32px_-18px_rgba(0,0,0,0.8)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  children,
  trailing,
  icon: Icon,
}: {
  children: ReactNode;
  trailing?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line/80 bg-well/40 px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-2 font-display text-[0.82rem] font-semibold uppercase tracking-[0.14em] text-gold-soft">
        {Icon ? <Icon className="size-4 shrink-0 text-gold" aria-hidden /> : null}
        <span className="min-w-0">{children}</span>
      </div>
      {trailing}
    </div>
  );
}

export function CardBody({ children }: { children: ReactNode }) {
  return <div className="p-4">{children}</div>;
}

export function Text({
  children,
  tone = "primary",
  className,
}: {
  children: ReactNode;
  tone?: "primary" | "secondary" | "tertiary";
  className?: string;
}) {
  return (
    <p
      className={cx(
        "m-0",
        tone === "secondary" && "text-muted",
        tone === "tertiary" && "text-[0.85rem] text-faint",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function Stat({
  value,
  label,
  icon: Icon,
  tone = "normal",
}: {
  value: ReactNode;
  label: string;
  icon?: LucideIcon;
  tone?: "normal" | "bad" | "good";
}) {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-well/70 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-faint">
        {Icon ? <Icon className="size-3.5 text-gold/80" aria-hidden /> : null}
        {label}
      </div>
      <div
        className={cx(
          "mt-0.5 truncate text-lg font-semibold tabular-nums",
          tone === "bad" && "text-crimson-soft",
          tone === "good" && "text-verdant",
          tone === "normal" && "text-ink",
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function Pill({
  children,
  active = false,
}: {
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[0.78rem] leading-snug",
        active
          ? "border-gold/60 bg-gold/10 text-gold-soft"
          : "border-line bg-well/70 text-muted",
      )}
    >
      {children}
    </span>
  );
}

const BUTTON_VARIANTS = {
  primary:
    "border-gold/70 bg-gradient-to-b from-gold-soft to-gold text-void shadow-[0_6px_18px_-8px_rgba(197,160,89,0.7)] hover:from-gold-soft hover:to-gold-soft",
  secondary:
    "border-line bg-raised/70 text-ink hover:border-gold/50 hover:bg-raised",
  ghost:
    "border-transparent bg-transparent text-muted hover:bg-raised/50 hover:text-ink",
  danger:
    "border-crimson/70 bg-crimson/85 text-ink shadow-[0_6px_18px_-8px_rgba(155,35,53,0.8)] hover:bg-crimson",
} as const;

export function Button({
  variant = "secondary",
  icon: Icon,
  size = "md",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof BUTTON_VARIANTS;
  icon?: LucideIcon;
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      className={cx(
        "inline-flex cursor-pointer select-none items-center justify-center gap-2 rounded-lg border font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none",
        size === "md" ? "min-h-11 px-3.5 text-[0.95rem]" : "min-h-9 px-2.5 text-sm",
        BUTTON_VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {Icon ? <Icon className="size-4 shrink-0" aria-hidden /> : null}
      {children}
    </button>
  );
}

export function Callout({
  title,
  children,
  tone = "info",
  icon: Icon,
  className,
}: {
  title: string;
  children: ReactNode;
  tone?: "info" | "warning";
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex gap-3 rounded-xl border px-3.5 py-3",
        tone === "warning"
          ? "border-crimson/60 bg-crimson/15"
          : "border-gold/35 bg-gold/[0.07]",
        className,
      )}
    >
      {Icon ? (
        <Icon
          className={cx(
            "mt-0.5 size-5 shrink-0",
            tone === "warning" ? "text-crimson-soft" : "text-gold",
          )}
          aria-hidden
        />
      ) : null}
      <div className="min-w-0">
        <div
          className={cx(
            "mb-0.5 font-semibold",
            tone === "warning" ? "text-crimson-soft" : "text-gold-soft",
          )}
        >
          {title}
        </div>
        <div className="text-[0.92rem] text-ink/90">{children}</div>
      </div>
    </div>
  );
}

export function Divider() {
  return <hr className="m-0 h-px border-0 bg-line" />;
}

export function Spacer() {
  return <div className="flex-1" />;
}

/** Collapsible segment for secondary controls that should stay on the page. */
export function Accordion({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <details className="group rounded-xl border border-line bg-well/50">
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3.5 text-sm font-medium text-muted hover:text-ink group-open:text-ink">
        {Icon ? <Icon className="size-4 text-gold/80" aria-hidden /> : null}
        <span className="flex-1">{title}</span>
        <ChevronDown
          className="size-4 transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="border-t border-line px-3.5 py-3">{children}</div>
    </details>
  );
}

/** Right-hand slide-out panel for long reference text. */
export function Drawer({
  open,
  onClose,
  title,
  icon: Icon,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: LucideIcon;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close panel"
        className="absolute inset-0 animate-fade-in cursor-default bg-void/70 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex h-full w-full max-w-md animate-drawer-in flex-col border-l border-gold/25 bg-surface shadow-2xl"
      >
        <header className="flex items-center gap-2 border-b border-line bg-well/60 px-4 py-3">
          {Icon ? <Icon className="size-5 text-gold" aria-hidden /> : null}
          <h2 className="flex-1 text-base font-semibold tracking-[0.08em] text-gold-soft">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close"
            className="grid size-9 cursor-pointer place-items-center rounded-lg text-muted hover:bg-raised hover:text-ink"
            onClick={onClose}
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
      </aside>
    </div>,
    document.body,
  );
}
