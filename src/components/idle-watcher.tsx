"use client";

import { useEffect, useRef } from "react";

// Real-inactivity logout. The server-side proxy keeps a 30-min ceiling
// based on request cadence (`erp_last_active` cookie), but that misses the
// case of a tab left open idle — the cookie just keeps refreshing on
// background fetches and prefetches.
//
// This component tracks honest user activity (mouse, keyboard, touch,
// scroll, tab-visibility) on every authenticated page. When real activity
// stops for `windowMs`, it forces a redirect to /login?reason=idle.
//
// Server pings:
//   - on real activity events
//   - throttled to once per PING_INTERVAL_MS so a busy mouse doesn't DDoS
//   - so the server's `erp_last_active` cookie stays fresh in lockstep
type Props = {
  /** Idle window before forced logout, in milliseconds. Default: 15 min. */
  windowMs?: number;
};

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "visibilitychange",
] as const;

// Don't ping more than once per minute; activity events fire dozens of times
// a second on a busy page and we don't want the network to feel them.
const PING_INTERVAL_MS = 60_000;

// How often the watchdog checks "have we been idle past windowMs?" — 30 s
// is fine-grained enough that the user sees the logout happen close to the
// configured boundary without burning CPU.
const CHECK_INTERVAL_MS = 30_000;

export default function IdleWatcher({ windowMs = 15 * 60 * 1000 }: Props) {
  // Refs start at 0 and the effect sets the real "now" on mount so the
  // function body stays pure (React's strict-mode purity rule rejects
  // Date.now() inline in the component body).
  const lastActivityRef = useRef<number>(0);
  const lastPingRef = useRef<number>(0);

  useEffect(() => {
    lastActivityRef.current = Date.now();
    const ping = () => {
      const now = Date.now();
      if (now - lastPingRef.current < PING_INTERVAL_MS) return;
      lastPingRef.current = now;
      // Fire-and-forget; the proxy stamps the cookie on its way through.
      // keepalive lets the browser send it even if the user navigates away
      // mid-flight (e.g. closing the tab).
      void fetch("/api/auth/ping", { method: "POST", keepalive: true }).catch(() => {});
    };

    const onActivity = () => {
      lastActivityRef.current = Date.now();
      ping();
    };

    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, onActivity, { passive: true });
    }

    // Watchdog: if we've been idle past `windowMs`, force logout. Uses an
    // interval rather than a single setTimeout so device-sleep / suspend
    // can't silently delay the check by hours.
    const watchdog = window.setInterval(() => {
      const idleFor = Date.now() - lastActivityRef.current;
      if (idleFor < windowMs) return;
      // Hard navigation so the proxy clears the session cookies on the
      // way to /login. `reason=idle` lets the login page show a hint.
      window.location.href = "/login?reason=idle";
    }, CHECK_INTERVAL_MS);

    return () => {
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, onActivity);
      }
      window.clearInterval(watchdog);
    };
  }, [windowMs]);

  return null;
}
