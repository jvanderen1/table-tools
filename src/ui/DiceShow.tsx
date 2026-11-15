import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { cx } from "../lib/cx";
import {
  dieModel,
  faceLabel,
  layoutThrow,
  type DieFace,
  type ThrownChip,
  type ThrownDie,
} from "./diceGeometry";

export type DiceThrow = {
  id: string;
  label: string;
  total: number;
  result?: string;
  flag?: "crit" | "miss" | "fail";
  faces: DieFace[];
};

const THROW_MS = 1050;
const HOLD_MS = 2400;
const STILL_MS = 1300;

/**
 * Dice tumbling across the viewport. The faces are already decided; this only
 * plays them. Pointer events pass through so the sheet underneath stays put.
 */
export function DiceShow({ roll }: { roll: DiceThrow | null }) {
  const reduce = useReducedMotion();
  const [hiddenId, setHiddenId] = useState<string | null>(null);
  const rollId = roll?.id ?? null;

  useEffect(() => {
    if (!rollId) return;
    const timer = window.setTimeout(
      () => setHiddenId(rollId),
      reduce ? STILL_MS : HOLD_MS,
    );
    return () => window.clearTimeout(timer);
  }, [rollId, reduce]);

  if (!roll || hiddenId === roll.id || roll.faces.length === 0) return null;
  if (typeof document === "undefined") return null;

  const pieces = layoutThrow(roll.faces, window.innerWidth);
  if (pieces.length === 0) return null;
  const tone =
    roll.flag === "crit"
      ? "text-gold-soft"
      : roll.flag
        ? "text-crimson-soft"
        : "text-ink";

  return createPortal(
    <div
      data-dice-show
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-[calc(40vh-5.5rem)] z-[45] h-44"
      style={{ perspective: "920px", perspectiveOrigin: "50% 62%" }}
    >
      <div
        className="absolute inset-x-0 top-11 bottom-0"
        style={{ transformStyle: "preserve-3d" }}
      >
        <div
          className="absolute top-1/2 left-1/2 h-0 w-0"
          style={{ transformStyle: "preserve-3d" }}
        >
          {pieces.map((piece, index) =>
            piece.kind === "chip" ? (
              <Chip key={`${roll.id}-more`} piece={piece} reduce={reduce} />
            ) : (
              <FlyingDie
                key={`${roll.id}-${index}`}
                die={piece}
                reduce={reduce}
                crit={roll.flag === "crit"}
              />
            ),
          )}
        </div>
      </div>
      <div
        className="absolute inset-x-0 top-0 flex justify-center"
        style={
          reduce
            ? undefined
            : {
                animationName: "dice-pill",
                animationDuration: `${THROW_MS}ms`,
                animationFillMode: "both",
                animationTimingFunction: "ease-out",
              }
        }
      >
        <div className="flex h-10 max-w-[90vw] items-center gap-2.5 rounded-full border border-gold/40 bg-void/85 px-3.5 shadow-[0_12px_28px_-14px_rgba(0,0,0,0.85)] backdrop-blur-sm">
          <span className="truncate text-xs font-semibold tracking-wide text-muted">
            {roll.label}
          </span>
          <span
            className={cx(
              "font-display text-2xl leading-none font-semibold tabular-nums",
              tone,
            )}
          >
            {roll.result ?? roll.total}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function FlyingDie({
  die,
  reduce,
  crit,
}: {
  die: ThrownDie;
  reduce: boolean;
  crit: boolean;
}) {
  const model = dieModel(die.sides, die.radius);
  const target = model.find((face) => face.value === die.face);
  if (!target) return null;
  const ivory = die.dropped ? "#cbb892" : "#f3e4c4";
  const ink = die.dropped ? "#6e5d46" : "#2a2118";
  const end = target.orient;
  const travel = motion(reduce, "dice-travel", die.delay, {
    "--from-x": `${die.fromX}px`,
    "--land-x": `${die.landX}px`,
  });
  const spin = motion(reduce, "dice-spin", die.delay, {
    "--x0": `${end.x + die.spin.x}deg`,
    "--y0": `${end.y + die.spin.y}deg`,
    "--z0": `${end.z + die.spin.z}deg`,
    "--x1": `${end.x}deg`,
    "--y1": `${end.y}deg`,
    "--z1": `${end.z}deg`,
  });

  return (
    <>
      <div
        className="absolute h-2.5 rounded-full bg-black/45 blur-[1.5px]"
        style={{
          top: die.radius * 0.62,
          width: die.radius * 1.35,
          marginLeft: -die.radius * 0.67,
          transform: `translate3d(${die.landX}px, 0, 0)`,
          ...motion(reduce, "dice-shadow", die.delay, {
            "--from-x": `${die.fromX}px`,
            "--land-x": `${die.landX}px`,
          }),
        }}
      />
      {crit && !die.dropped ? (
        <div
          className="absolute rounded-full bg-gold/30 blur-md"
          style={{
            width: die.radius * 2.1,
            height: die.radius * 2.1,
            marginLeft: -die.radius * 1.05,
            marginTop: -die.radius * 1.05,
            transform: `translate3d(${die.landX}px, 0, 0)`,
            ...travel,
          }}
        />
      ) : null}
      <div
        className="absolute top-0 left-0 h-0 w-0"
        style={{
          transformStyle: "preserve-3d",
          transform: `translate3d(${die.landX}px, 0, 0)`,
          ...travel,
        }}
      >
        <div
          className="absolute top-0 left-0 h-0 w-0"
          style={{
            transformStyle: "preserve-3d",
            transform: `rotateX(${end.x}deg) rotateY(${end.y}deg) rotateZ(${end.z}deg)`,
            ...spin,
          }}
        >
          {model.map((face) => (
            <div
              key={face.value}
              className="absolute top-0 left-0 grid place-items-center font-display leading-none font-semibold"
              style={{
                width: face.size,
                height: face.size,
                marginLeft: -face.size / 2,
                marginTop: -face.size / 2,
                transform: face.transform,
                clipPath: face.clip,
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
                background: `linear-gradient(155deg, color-mix(in oklab, white 50%, ${faceColor(ivory, face.shade)}), ${faceColor(ivory, face.shade)} 42%, color-mix(in oklab, #2a1c10 35%, ${faceColor(ivory, face.shade)}))`,
                color: ink,
                fontSize: face.font,
                textShadow: "0 1px 0 rgba(255,255,255,0.45)",
                boxShadow:
                  crit && !die.dropped
                    ? "inset 0 0 0 2px rgba(138, 96, 32, 0.9)"
                    : "inset 0 0 0 2px rgba(62, 41, 16, 0.55)",
              }}
            >
              {faceLabel(face.value, die.mode)}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function Chip({ piece, reduce }: { piece: ThrownChip; reduce: boolean }) {
  const size = piece.radius * 2;
  return (
    <div
      className="absolute top-0 left-0 grid place-items-center rounded-full border border-gold/50 bg-void/80 font-display font-semibold text-gold-soft"
      style={{
        width: size,
        height: size,
        marginLeft: -piece.radius,
        marginTop: -piece.radius,
        fontSize: Math.round(piece.radius * 0.52),
        transform: `translate3d(${piece.landX}px, 0, 0)`,
        ...motion(reduce, "dice-travel", piece.delay, {
          "--from-x": `${piece.fromX}px`,
          "--land-x": `${piece.landX}px`,
        }),
      }}
    >
      +{piece.extra}
    </div>
  );
}

function faceColor(ivory: string, shade: number) {
  return `color-mix(in oklab, ${ivory} ${Math.round(shade * 100)}%, #3d2a14)`;
}

function motion(
  reduce: boolean,
  name: "dice-travel" | "dice-spin" | "dice-shadow",
  delay: number,
  vars: Record<string, string>,
): CSSProperties {
  if (reduce) return vars as CSSProperties;
  return {
    ...(vars as CSSProperties),
    animationName: name,
    animationDuration: `${THROW_MS}ms`,
    animationDelay: `${delay}ms`,
    animationTimingFunction: "cubic-bezier(0.15, 0.64, 0.2, 1)",
    animationFillMode: "both",
  };
}

function useReducedMotion() {
  const [reduce, setReduce] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduce(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduce;
}
