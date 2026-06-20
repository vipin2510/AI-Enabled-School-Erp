"use client";

import { useState } from "react";
import { DownloadButton } from "@/components/ui/download-button";
import { PreviewButton } from "@/components/ui/preview-button";

type Props = {
  classes: { id: string; display_name: string }[];
  sectionsByClass: Record<string, string[]>;
};

const field = "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900";
const label = "block text-xs font-medium text-stone-600 mb-1";

export default function IdCardForm({ classes, sectionsByClass }: Props) {
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [section, setSection] = useState("");
  const [perPage, setPerPage] = useState(6);
  const [w, setW] = useState(6);
  const [h, setH] = useState(9);

  const sections = sectionsByClass[classId] ?? [];

  const params = new URLSearchParams({ classId, perPage: String(perPage), w: String(w), h: String(h) });
  if (section) params.set("section", section);
  const downloadUrl = `/api/id-cards?${params.toString()}`;

  return (
    <div className="card space-y-4 p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={label}>Class</label>
          <select
            className={field}
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setSection("");
            }}
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Section</label>
          <select className={field} value={section} onChange={(e) => setSection(e.target.value)}>
            <option value="">All sections</option>
            {sections.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className={label}>Cards per page</label>
          <input
            type="number"
            min={1}
            max={12}
            value={perPage}
            onChange={(e) => setPerPage(Number(e.target.value))}
            className={field}
          />
        </div>
        <div>
          <label className={label}>Card width (cm)</label>
          <input
            type="number"
            min={4}
            max={12}
            step={0.5}
            value={w}
            onChange={(e) => setW(Number(e.target.value))}
            className={field}
          />
        </div>
        <div>
          <label className={label}>Card height (cm)</label>
          <input
            type="number"
            min={5}
            max={16}
            step={0.5}
            value={h}
            onChange={(e) => setH(Number(e.target.value))}
            className={field}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-stone-400">
          Default: 6 cards/page · 6cm × 9cm. Opens a print-ready PDF.
        </p>
        <div className="flex flex-wrap gap-2">
          <PreviewButton
            url={downloadUrl}
            disabled={!classId}
            className="rounded-lg border border-stone-200 bg-white px-5 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
          >
            👁 Preview
          </PreviewButton>
          <DownloadButton
            url={downloadUrl}
            filename="id-cards.pdf"
            disabled={!classId}
            className="rounded-lg bg-stone-900 px-5 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
          >
            ⤓ Generate ID cards
          </DownloadButton>
        </div>
      </div>
    </div>
  );
}
