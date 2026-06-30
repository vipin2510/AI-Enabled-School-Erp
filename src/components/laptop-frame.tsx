"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/client";

// The live demo app, rendered at a fixed laptop viewport (1440×900) inside a
// MacBook silhouette, then scaled with CSS transform to fit the window. The app
// inside therefore always sees a real laptop width (no responsive surprises),
// and transform:scale() preserves pointer mapping so the iframe stays clickable.
const SCREEN_W = 1440;
const SCREEN_H = 900;
// Outer footprint incl. bezel + base, used to compute the fit scale.
const FRAME_W = 1560;
const FRAME_H = 1060;

export default function LaptopFrame({ src = "/?demo_frame=1" }: { src?: string }) {
  const t = useT();
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const fit = () => {
      const k = Math.min(
        window.innerWidth / FRAME_W,
        window.innerHeight / FRAME_H,
        1,
      );
      setScale(k > 0 ? k : 1);
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center overflow-hidden bg-stone-200">
      <div style={{ transform: `scale(${scale})`, transformOrigin: "center center" }}>
        {/* Screen: aluminium bezel around the viewport */}
        <div className="rounded-[1.75rem] border border-stone-400 bg-stone-800 p-4 shadow-2xl">
          {/* camera dot */}
          <div className="mx-auto mb-2 h-1.5 w-1.5 rounded-full bg-stone-600" />
          <div
            className="overflow-hidden rounded-lg bg-white"
            style={{ width: SCREEN_W, height: SCREEN_H }}
          >
            <iframe
              src={src}
              title={t("Laptop preview")}
              className="block border-0 bg-white"
              style={{ width: SCREEN_W, height: SCREEN_H }}
            />
          </div>
        </div>
        {/* Base / hinge */}
        <div className="relative mx-auto" style={{ width: FRAME_W }}>
          <div className="mx-auto h-3 rounded-b-xl bg-gradient-to-b from-stone-300 to-stone-400" style={{ width: SCREEN_W + 120 }} />
          <div className="mx-auto h-1.5 w-40 rounded-b-lg bg-stone-400" />
        </div>
      </div>

      <Link
        href="/demo/mobile"
        className="mt-2 text-sm text-stone-500 underline hover:text-stone-800"
      >
        {t("Switch to mobile view")}
      </Link>
    </div>
  );
}
