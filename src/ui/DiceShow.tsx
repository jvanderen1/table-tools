import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import DiceBox from "@3d-dice/dice-box-threejs";
import { cx } from "../lib/cx";
import { diceBoxNotation, type DieFace } from "./diceGeometry";

export type DiceThrow = {
  id: string;
  label: string;
  total: number;
  result?: string;
  flag?: "crit" | "miss" | "fail";
  faces: DieFace[];
};

/**
 * Physics dice from `@3d-dice/dice-box-threejs`. That build can be told which
 * face to land on. `@3d-dice/dice-box` cannot, so the pictured number would
 * drift from the log. The floor is hidden so the dice cross the sheet.
 */
export function DiceShow({
  roll,
  holdMs,
  onDismiss,
}: {
  roll: DiceThrow | null;
  /** Milliseconds to linger. Null stays until dismissed or the next roll. */
  holdMs: number | null;
  onDismiss: () => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const boxRef = useRef<{ box: DiceBox; ready: Promise<void> } | null>(null);
  const rollId = roll?.id ?? null;
  const notation = roll ? diceBoxNotation(roll.faces) : "";

  useEffect(() => {
    if (!rollId || holdMs == null) return;
    const timer = window.setTimeout(onDismiss, holdMs);
    return () => window.clearTimeout(timer);
  }, [rollId, holdMs, onDismiss]);

  useEffect(() => {
    if (!rollId) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onDismiss();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [rollId, onDismiss]);

  useEffect(() => {
    const host = stage.current;
    if (!host) return;
    const box = new DiceBox(`#${host.id}`, {
      sounds: false,
      shadows: true,
      theme_colorset: "white",
      theme_texture: "",
      theme_material: "plastic",
      theme_surface: "green-felt",
    });
    let dead = false;
    let released = false;
    function release() {
      if (released) return;
      const renderer = box.renderer;
      if (!renderer) return;
      released = true;
      box.renderer = {
        render() {},
        dispose() {},
        forceContextLoss() {},
        domElement: renderer.domElement,
      };
      box.setDimensions = () => {};
      box.clearDice();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    }
    const ready = box.initialize().then(() => {
      if (dead) {
        release();
        return;
      }
      if (box.desk) box.desk.visible = false;
    });
    boxRef.current = { box, ready };
    return () => {
      dead = true;
      release();
      boxRef.current = null;
    };
  }, []);

  useEffect(() => {
    const current = boxRef.current;
    if (!current) return;
    if (!notation) {
      if (current.box.renderer) current.box.clearDice();
      return;
    }
    let cancelled = false;
    current.ready
      .then(() => {
        if (cancelled) return;
        if (current.box.desk) current.box.desk.visible = false;
        return current.box.roll(notation);
      })
      .catch(() => {
        // A failed scene must not block the logged number.
      });
    return () => {
      cancelled = true;
    };
  }, [rollId, notation]);

  if (typeof document === "undefined") return null;
  const showing = Boolean(roll && notation);

  const tone =
    roll?.flag === "crit"
      ? "text-gold-soft"
      : roll?.flag
        ? "text-crimson-soft"
        : "text-ink";

  return createPortal(
    <div
      data-dice-show={showing ? "" : undefined}
      className={cx(
        "pointer-events-none fixed inset-0 z-[45]",
        showing ? "" : "invisible",
      )}
    >
      <div
        ref={stage}
        id="dice-box-stage"
        className="absolute inset-0 [&_canvas]:h-full [&_canvas]:w-full"
      />
      {showing && roll ? (
        <div className="absolute inset-x-0 top-[12vh] flex justify-center">
          <button
            type="button"
            className="pointer-events-auto flex h-10 max-w-[90vw] cursor-pointer items-center gap-2.5 rounded-full border border-gold/40 bg-void/85 px-3.5 shadow-[0_12px_28px_-14px_rgba(0,0,0,0.85)] backdrop-blur-sm"
            aria-label={`Dismiss ${roll.label}`}
            onClick={onDismiss}
          >
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
            <X className="size-3.5 shrink-0 text-faint" aria-hidden />
          </button>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
