"use client";

import { useEffect } from "react";

// Breaks out of an iframe to the top window. The demo runs the app inside an
// iframe (laptop/phone frames); pages that must NEVER live inside that iframe —
// the landing and the frame-host pages — mount this so e.g. exiting the demo
// from within the frame (which navigates the iframe to /login) takes over the
// whole window instead of rendering a page-inside-the-frame (and a frame inside
// a frame on the next demo start).
export default function FrameBuster() {
  useEffect(() => {
    if (window.top && window.top !== window.self) {
      window.top.location.replace(window.location.href);
    }
  }, []);
  return null;
}
