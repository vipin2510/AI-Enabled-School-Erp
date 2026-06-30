"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useT } from "@/lib/i18n/client";
import { goToDemoStop } from "@/app/actions/demo";
import {
  TOUR_STOPS,
  TOUR_STATE_KEY,
  TOUR_SEEN_KEY,
  findStopForPath,
} from "@/lib/demo-tour";
import type { Department } from "@/lib/access";

// Cross-page tour state lives in localStorage so it survives iframe navigations.
function readStop(): number | null {
  try {
    const raw = localStorage.getItem(TOUR_STATE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { stop?: number };
    return typeof v.stop === "number" ? v.stop : null;
  } catch {
    return null;
  }
}
function writeStop(stop: number) {
  try {
    localStorage.setItem(TOUR_STATE_KEY, JSON.stringify({ stop }));
  } catch {}
}
function clearStop() {
  try {
    localStorage.removeItem(TOUR_STATE_KEY);
  } catch {}
}
function markSeen() {
  try {
    localStorage.setItem(TOUR_SEEN_KEY, "1");
  } catch {}
}
function isSeen(): boolean {
  try {
    return localStorage.getItem(TOUR_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

// Guided product tour for the demo. Mounted in the app shell only when
// profile.is_demo. driver.js drives each stop's steps; the last step of a stop
// advances state and navigates to the next module (switching department via the
// goToDemoStop server action when needed). Non-blocking: a missing target is
// simply skipped, and Skip/close ends the tour for the session.
export default function DemoTour({ department }: { department: Department }) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);
  const startedRef = useRef(false);
  const [runNonce, setRunNonce] = useState(0);

  useEffect(() => {
    let activeStop = readStop();

    // Auto-start once per browser: jump to the first stop's page.
    if (activeStop === null && !isSeen() && !startedRef.current) {
      startedRef.current = true;
      writeStop(0);
      activeStop = 0;
      if (findStopForPath(pathname) !== 0) {
        void goToDemoStop(TOUR_STOPS[0].dept, TOUR_STOPS[0].href);
        return;
      }
    }
    if (activeStop === null) return;

    const stopIdx = findStopForPath(pathname);
    if (stopIdx === -1 || stopIdx !== activeStop) return; // wait for the right page

    const stop = TOUR_STOPS[stopIdx];
    let cancelled = false;

    const start = () => {
      if (cancelled) return;
      const d = driver({
        showProgress: true,
        allowClose: true,
        popoverClass: "demo-tour-popover",
        overlayColor: "rgba(0,0,0,0.6)",
        nextBtnText: t("Next"),
        prevBtnText: t("Back"),
        doneBtnText: t("Done"),
        progressText: "{{current}} / {{total}}",
        steps: stop.steps.map((s) => ({
          element: s.selector,
          popover: { title: t(s.title), description: t(s.body) },
        })),
        onNextClick: () => {
          const i = d.getActiveIndex() ?? 0;
          if (i < stop.steps.length - 1) {
            d.moveNext();
            return;
          }
          // Last step of this stop → advance to the next module.
          const nextIdx = stopIdx + 1;
          if (nextIdx >= TOUR_STOPS.length) {
            markSeen();
            clearStop();
            d.destroy();
            return;
          }
          writeStop(nextIdx);
          d.destroy();
          const next = TOUR_STOPS[nextIdx];
          if (next.dept === department) router.push(next.href);
          else void goToDemoStop(next.dept, next.href);
        },
        onCloseClick: () => {
          markSeen();
          clearStop();
          d.destroy();
        },
        onDestroyed: () => {
          driverRef.current = null;
        },
      });
      driverRef.current = d;
      d.drive();
    };

    // Wait for the first target to mount before driving (non-blocking: give up
    // after a few frames and start anyway — driver skips missing elements).
    const firstSel = stop.steps[0]?.selector;
    let tries = 30;
    const tick = () => {
      if (cancelled) return;
      if (!firstSel || document.querySelector(firstSel) || tries-- <= 0) start();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      driverRef.current?.destroy();
      driverRef.current = null;
    };
  }, [pathname, department, t, router, runNonce]);

  const replay = () => {
    try {
      localStorage.removeItem(TOUR_SEEN_KEY);
    } catch {}
    writeStop(0);
    if (findStopForPath(pathname) === 0) {
      setRunNonce((n) => n + 1); // re-run the effect on the current page
    } else {
      void goToDemoStop(TOUR_STOPS[0].dept, TOUR_STOPS[0].href);
    }
  };

  return (
    <button
      type="button"
      onClick={replay}
      data-tour-replay
      className="fixed bottom-4 right-4 z-[100000] rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-lg hover:bg-stone-50"
    >
      ✨ {t("Tour")}
    </button>
  );
}
