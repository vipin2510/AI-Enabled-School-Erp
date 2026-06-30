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
// Padding around the highlighted element — shared by driver's cutout
// (stagePadding) and our blur panels, kept just larger than the on-element
// border (box-shadow, see globals.css) so the border isn't blurred.
const FOCUS_PAD = 6;
const FOCUS_RADIUS = 14;

export default function DemoTour({ department }: { department: Department }) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);
  const startedRef = useRef(false);
  const [runNonce, setRunNonce] = useState(0);
  // Geometry of the highlighted box. We draw our OWN border + blur panels around
  // this rect (rather than blurring driver's overlay), so the focused element
  // AND the popover both stay sharp and the border hugs the box edge exactly.
  const activeElRef = useRef<Element | null>(null);
  const [hole, setHole] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

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

    // Recompute the focus rectangle from the current highlighted element.
    const updateHole = () => {
      const el = activeElRef.current;
      if (!el) {
        setHole(null);
        return;
      }
      const r = el.getBoundingClientRect();
      // The padded rect IS the highlighted region: blur panels, the dim cutout
      // (driver stagePadding) and the border all use it, so the border sits
      // exactly on the boundary — nothing sharp spills outside it.
      setHole({
        top: r.top - FOCUS_PAD,
        left: r.left - FOCUS_PAD,
        width: r.width + FOCUS_PAD * 2,
        height: r.height + FOCUS_PAD * 2,
      });
    };

    const start = () => {
      if (cancelled) return;
      const d = driver({
        showProgress: true,
        allowClose: true,
        popoverClass: "demo-tour-popover",
        // We draw our own dim + blur panels (keyed to the same rect as the
        // border), so driver's overlay is made invisible — otherwise its cutout
        // doesn't match our rect and leaves a sharp halo outside the border.
        overlayOpacity: 0,
        stagePadding: FOCUS_PAD,
        stageRadius: FOCUS_RADIUS,
        nextBtnText: t("Next"),
        prevBtnText: t("Back"),
        doneBtnText: t("Done"),
        progressText: "{{current}} / {{total}}",
        // Update at the START of the step so our spotlight CSS-transitions in
        // sync with driver's own animation (rather than snapping at the end).
        onHighlightStarted: (el) => {
          activeElRef.current = el ?? null;
          updateHole();
        },
        onHighlighted: (el) => {
          activeElRef.current = el ?? null;
          updateHole();
        },
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
          activeElRef.current = null;
          setHole(null);
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
      if (!firstSel || document.querySelector(firstSel) || tries-- <= 0)
        start();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    // Keep the focus box aligned if the page scrolls or the window resizes.
    const onMove = () => updateHole();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);

    return () => {
      cancelled = true;
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
      driverRef.current?.destroy();
      driverRef.current = null;
      activeElRef.current = null;
      setHole(null);
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

  // These panels only BLUR around the highlighted rect; the rounded dim + border
  // are drawn by the spotlight div below. pointer-events:none so the highlighted
  // element stays interactive.
  const blur =
    "fixed pointer-events-none z-[9999] [backdrop-filter:blur(2px)] [-webkit-backdrop-filter:blur(2px)]";
  // Smoothly slide the spotlight/blur between steps (matches driver's ~0.4s).
  const trans = "top .35s ease, left .35s ease, width .35s ease, height .35s ease, bottom .35s ease, right .35s ease";

  return (
    <>
      {hole && (
        <>
          {/* Blur everything around the highlighted region (the region stays sharp). */}
          <div
            className={blur}
            style={{ top: 0, left: 0, right: 0, height: Math.max(0, hole.top), transition: trans }}
          />
          <div
            className={blur}
            style={{ top: hole.top + hole.height, left: 0, right: 0, bottom: 0, transition: trans }}
          />
          <div
            className={blur}
            style={{ top: hole.top, left: 0, width: Math.max(0, hole.left), height: hole.height, transition: trans }}
          />
          <div
            className={blur}
            style={{ top: hole.top, left: hole.left + hole.width, right: 0, height: hole.height, transition: trans }}
          />
          {/* Rounded spotlight: the huge box-shadow dims everything OUTSIDE the
              rounded rect — it follows border-radius, so the corners are covered
              too (no square white spill) — and the thick border sits exactly on
              that rounded edge, like the popover's own border. */}
          <div
            className="fixed pointer-events-none z-[10001]"
            style={{
              top: hole.top,
              left: hole.left,
              width: hole.width,
              height: hole.height,
              border: "4px solid var(--accent)",
              borderRadius: FOCUS_RADIUS,
              boxShadow: "0 0 0 9999px rgba(28, 25, 23, 0.5)",
              transition: trans,
            }}
          />
        </>
      )}
      <button
        type="button"
        onClick={replay}
        data-tour-replay
        className="fixed bottom-4 right-4 z-[100000] rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-lg hover:bg-stone-50"
      >
        ✨ {t("Tour")}
      </button>
    </>
  );
}
