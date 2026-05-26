"use client";

import { useState } from "react";
import Image from "next/image";
import Viewer from "react-viewer";
// This build of react-viewer injects its own styles at runtime (no CSS file).

type Slot = { url: string | null; label: string };

// Two photo cards (student + parent) using next/image (lazy + optimized), with
// click-to-zoom via react-viewer.
export default function ProfilePhotos({
  student,
  parent,
}: {
  student: string | null;
  parent: string | null;
}) {
  const slots: Slot[] = [
    { url: student, label: "Student" },
    { url: parent, label: "Parent" },
  ];
  const present = slots.filter((s): s is { url: string; label: string } => !!s.url);

  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(0);

  const open = (url: string) => {
    const i = present.findIndex((p) => p.url === url);
    setIndex(i < 0 ? 0 : i);
    setVisible(true);
  };

  return (
    <div className="space-y-4">
      {slots.map((s) => (
        <div key={s.label} className="card overflow-hidden p-0">
          <button
            type="button"
            onClick={() => s.url && open(s.url)}
            disabled={!s.url}
            className="relative block aspect-[3/4] w-full bg-stone-50"
          >
            {s.url ? (
              <Image src={s.url} alt={s.label} fill sizes="260px" className="object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-sm text-stone-400">
                No {s.label.toLowerCase()} photo
              </span>
            )}
          </button>
          <div className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-stone-500">
            {s.label}
          </div>
        </div>
      ))}

      {present.length > 0 && (
        <Viewer
          visible={visible}
          onClose={() => setVisible(false)}
          activeIndex={index}
          images={present.map((p) => ({ src: p.url, alt: p.label }))}
          zIndex={60}
        />
      )}
    </div>
  );
}
