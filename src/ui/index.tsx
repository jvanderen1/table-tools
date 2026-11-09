import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

export function Stack({
  children,
  gap = 12,
  style,
}: {
  children: ReactNode;
  gap?: number;
  style?: CSSProperties;
}) {
  return (
    <div className="stack" style={{ gap, ...style }}>
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
}: {
  children: ReactNode;
  gap?: number;
  wrap?: boolean;
  align?: CSSProperties["alignItems"];
  style?: CSSProperties;
}) {
  return (
    <div
      className={`row${wrap ? " wrap" : ""}`}
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
      className={`grid grid-${columns}`}
      style={{ gap }}
    >
      {children}
    </div>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <section className="card">{children}</section>;
}

export function CardHeader({
  children,
  trailing,
}: {
  children: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="card-header">
      <div>{children}</div>
      {trailing}
    </div>
  );
}

export function CardBody({ children }: { children: ReactNode }) {
  return <div className="card-body">{children}</div>;
}

export function Text({
  children,
  tone = "primary",
}: {
  children: ReactNode;
  tone?: "primary" | "secondary" | "tertiary";
}) {
  const className =
    tone === "secondary" ? "muted" : tone === "tertiary" ? "tertiary" : undefined;
  return <p className={className} style={{ margin: 0 }}>{children}</p>;
}

export function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
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
  return <span className={`pill${active ? " active" : ""}`}>{children}</span>;
}

export function Button({
  variant = "secondary",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
}) {
  const className = [
    "btn",
    variant === "primary" ? "btn-primary" : "",
    variant === "ghost" ? "btn-ghost" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button type="button" className={className} {...props}>
      {children}
    </button>
  );
}

export function Callout({
  title,
  children,
  tone = "info",
}: {
  title: string;
  children: ReactNode;
  tone?: "info" | "warning";
}) {
  return (
    <div className={`callout ${tone}`}>
      <div className="callout-title">{title}</div>
      <div>{children}</div>
    </div>
  );
}

export function Divider() {
  return <hr className="divider" />;
}

export function Spacer() {
  return <div className="spacer" />;
}
