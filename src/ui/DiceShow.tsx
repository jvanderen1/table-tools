import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import DiceBox from "@3d-dice/dice-box-threejs";
import { cx } from "../lib/cx";
import { diceBoxNotation, type DieFace } from "./diceGeometry";

type SettledDie = {
  position: { x: number; y: number; z: number };
  quaternion: { x: number; y: number; z: number; w: number };
};

/** The physics sleep can lag long after a die looks still. Watch the meshes. */
function watchUntilStill(box: { diceList?: SettledDie[] }, onSettle: () => void) {
  let last = "";
  let stableFor = 0;
  let previous = performance.now();
  let frame = 0;
  const tick = (now: number) => {
    try {
      const dice = box.diceList ?? [];
      const dt = now - previous;
      previous = now;
      if (dice.length > 0) {
        const pose = dice
          .map((die) =>
            [
              die.position.x,
              die.position.y,
              die.position.z,
              die.quaternion.x,
              die.quaternion.y,
              die.quaternion.z,
              die.quaternion.w,
            ]
              .map((part) => part.toFixed(0))
              .join(","),
          )
          .join("|");
        if (pose === last) stableFor += dt;
        else {
          stableFor = 0;
          last = pose;
        }
        if (stableFor >= 280) {
          onSettle();
          return;
        }
      }
    } catch {
      // Keep waiting. The fallback reveals the total if a mesh has no pose.
    }
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}

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
  const [settledId, setSettledId] = useState<string | null>(null);
  const rollId = roll?.id ?? null;
  const notation = roll ? diceBoxNotation(roll.faces) : "";
  const settled = rollId != null && settledId === rollId;

  const dismiss = useCallback(() => {
    const box = boxRef.current?.box;
    if (box?.renderer) box.clearDice();
    onDismiss();
  }, [onDismiss]);

  const linger = holdMs != null && Number.isFinite(holdMs) ? holdMs : null;

  useEffect(() => {
    if (!rollId || linger == null || !settled) return;
    const timer = window.setTimeout(dismiss, linger);
    return () => window.clearTimeout(timer);
  }, [rollId, linger, dismiss, settled]);

  useEffect(() => {
    if (!rollId) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      dismiss();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [rollId, dismiss]);

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
    let stopWatching = () => {};
    let fallback = 0;
    const settle = () => {
      if (!cancelled) setSettledId(rollId);
    };
    current.ready
      .then(() => {
        if (cancelled) return;
        if (current.box.desk) current.box.desk.visible = false;
        const pending = current.box.roll(notation);
        stopWatching = watchUntilStill(current.box, settle);
        fallback = window.setTimeout(settle, 4000);
        return pending;
      })
      .then(settle)
      .catch(() => {
        // A failed scene must not hide the logged number.
        settle();
      });
    return () => {
      cancelled = true;
      stopWatching();
      window.clearTimeout(fallback);
    };
  }, [rollId, notation]);

  if (typeof document === "undefined") return null;
  const showing = Boolean(roll && notation);

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
        className="pointer-events-none absolute inset-0 [&_canvas]:pointer-events-none [&_canvas]:h-full [&_canvas]:w-full"
      />
      {showing && roll ? (
        <button
          type="button"
          className="pointer-events-auto absolute inset-0 cursor-pointer"
          aria-label={`Dismiss ${roll.label}`}
          onClick={dismiss}
        />
      ) : null}
    </div>,
    document.body,
  );
}
