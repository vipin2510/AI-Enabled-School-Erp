"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n/client";

// A ~390px phone mockup hosting the live app in a same-origin iframe. Because
// the iframe is same-origin, the demo cookie rides along automatically, so the
// full interactive app renders inside at mobile width (showcasing the existing
// responsive layout). `src` defaults to the app root in demo-frame mode.
export default function PhoneFrame({ src = "/?demo_frame=1" }: { src?: string }) {
  const t = useT();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-stone-100 px-4 py-8">
      <div className="rounded-[2.75rem] border border-stone-300 bg-stone-900 p-3 shadow-2xl">
        {/* notch */}
        <div className="relative">
          <div className="absolute left-1/2 top-0 z-10 h-5 w-28 -translate-x-1/2 rounded-b-2xl bg-stone-900" />
          <div className="overflow-hidden rounded-[2rem] bg-white">
            <iframe
              src={src}
              title={t("Mobile preview")}
              className="block h-[844px] w-[390px] border-0 bg-white"
            />
          </div>
        </div>
      </div>
      <Link href="/" className="text-sm text-stone-500 underline hover:text-stone-800">
        {t("Switch to laptop view")}
      </Link>
    </div>
  );
}
