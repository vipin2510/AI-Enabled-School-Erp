"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n/client";

// A non-interactive, scaled-down preview of a real demo frame (the exact
// LaptopFrame / PhoneFrame bezels running the live app), used on the /demo
// selection page. The whole tile is a link into that device's full demo; the
// iframe itself is pointer-events:none so it only selects, never operates.
const SRC = "/?demo_frame=1";

// Both previews are rendered at this exact height so they line up; widths come
// from each device's aspect ratio (laptop ends up much wider, phone narrow).
const PREVIEW_H = 520;

export default function DevicePreview({ kind }: { kind: "laptop" | "mobile" }) {
  const t = useT();
  const isLaptop = kind === "laptop";
  const href = isLaptop ? "/demo/laptop" : "/demo/mobile";
  const label = isLaptop ? t("View on laptop") : t("View on mobile");

  // Natural footprint of the bezel; scale so the bezel height == PREVIEW_H.
  const fullW = isLaptop ? 1560 : 414;
  const fullH = isLaptop ? 966 : 868;
  const k = PREVIEW_H / fullH;
  const scaledW = fullW * k;

  return (
    <Link href={href} className="group flex flex-col items-center">
      <div
        className="overflow-hidden transition group-hover:-translate-y-1"
        style={{ width: scaledW, height: PREVIEW_H }}
      >
        <div
          style={{
            transform: `scale(${k})`,
            transformOrigin: "top left",
            width: fullW,
            pointerEvents: "none",
          }}
        >
          {isLaptop ? <LaptopBezel /> : <PhoneBezel />}
        </div>
      </div>
      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 group-hover:text-accent">
        {label} <span className="transition group-hover:translate-x-0.5">→</span>
      </span>
    </Link>
  );
}

// Exact bezel markup mirrored from src/components/laptop-frame.tsx.
function LaptopBezel() {
  return (
    <div className="flex flex-col items-center">
      <div className="rounded-[1.75rem] border border-stone-400 bg-stone-800 p-4 shadow-2xl">
        <div className="mx-auto mb-2 h-1.5 w-1.5 rounded-full bg-stone-600" />
        <div className="overflow-hidden rounded-lg bg-white" style={{ width: 1440, height: 900 }}>
          <PreviewFrame title="Laptop demo preview" w={1440} h={900} />
        </div>
      </div>
      <div className="relative mx-auto" style={{ width: 1560 }}>
        <div
          className="mx-auto h-3 rounded-b-xl bg-gradient-to-b from-stone-300 to-stone-400"
          style={{ width: 1560 }}
        />
        <div className="mx-auto h-1.5 w-40 rounded-b-lg bg-stone-400" />
      </div>
    </div>
  );
}

// Exact bezel markup mirrored from src/components/phone-frame.tsx.
function PhoneBezel() {
  return (
    <div className="rounded-[2.75rem] border border-stone-300 bg-stone-900 p-3 shadow-2xl">
      <div className="relative">
        <div className="absolute left-1/2 top-0 z-10 h-5 w-28 -translate-x-1/2 rounded-b-2xl bg-stone-900" />
        <div className="overflow-hidden rounded-[2rem] bg-white">
          <PreviewFrame title="Mobile demo preview" w={390} h={844} />
        </div>
      </div>
    </div>
  );
}

function PreviewFrame({ title, w, h }: { title: string; w: number; h: number }) {
  return (
    <iframe
      src={SRC}
      title={title}
      aria-hidden
      tabIndex={-1}
      scrolling="no"
      className="block border-0 bg-white"
      style={{ width: w, height: h }}
    />
  );
}
