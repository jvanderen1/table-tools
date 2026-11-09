import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { RefreshCw, X } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Button } from "./ui";

const CHECK_EVERY_MS = 30 * 60 * 1000;

/**
 * Keeps the installed app current. Looks for a new version on launch, every
 * 30 minutes, and whenever the app comes back to the foreground. If nothing
 * has been tapped yet it reloads straight away; otherwise it asks first.
 */
export function UpdatePrompt() {
  const touched = useRef(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => {
        if (navigator.onLine) registration.update().catch(() => {});
      };
      window.setInterval(check, CHECK_EVERY_MS);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") check();
      });
    },
    onNeedRefresh() {
      if (!touched.current) void applyUpdate();
    },
  });

  async function applyUpdate() {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const waiting = registration?.waiting;
      if (waiting) {
        waiting.postMessage({ type: "SKIP_WAITING" });
        await new Promise<void>((resolve) => {
          const finish = () => {
            waiting.removeEventListener("statechange", onState);
            window.clearTimeout(timer);
            resolve();
          };
          const onState = () => {
            if (waiting.state === "activated") finish();
          };
          if (waiting.state === "activated") {
            resolve();
            return;
          }
          waiting.addEventListener("statechange", onState);
          const timer = window.setTimeout(finish, 1500);
        });
      }
    } catch {
      // Reload anyway so a stuck worker doesn't trap the page.
    }
    window.location.reload();
  }

  useEffect(() => {
    const mark = () => {
      touched.current = true;
    };
    window.addEventListener("pointerdown", mark, { once: true });
    window.addEventListener("keydown", mark, { once: true });
    return () => {
      window.removeEventListener("pointerdown", mark);
      window.removeEventListener("keydown", mark);
    };
  }, []);

  if (!needRefresh) return null;

  return createPortal(
    <div
      role="status"
      className="fixed inset-x-3 top-3 z-[60] flex animate-pop-in items-center gap-3 rounded-xl border border-gold/50 bg-surface px-3.5 py-2.5 shadow-[0_16px_36px_-10px_rgba(0,0,0,0.9)] sm:left-auto sm:w-[24rem]"
    >
      <RefreshCw className="size-4 shrink-0 text-gold" aria-hidden />
      <div className="min-w-0 flex-1 text-sm leading-5">
        <div className="text-ink">A new version is ready.</div>
        <div className="text-xs text-faint">Your sheet and notes are kept.</div>
      </div>
      <Button size="sm" variant="primary" onClick={() => void applyUpdate()}>
        Reload
      </Button>
      <button
        type="button"
        className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md text-faint hover:text-ink"
        aria-label="Later"
        title="Later"
        onClick={() => setNeedRefresh(false)}
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>,
    document.body,
  );
}
