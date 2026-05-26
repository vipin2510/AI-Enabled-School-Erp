"use client";

import { useState } from "react";
import { DownloadButton } from "@/components/ui/download-button";

export default function LabelDownload({ count }: { count: number }) {
  const [perPage, setPerPage] = useState(12);
  const field = "rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900";

  return (
    <div className="card space-y-4 p-5">
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">Labels per page</label>
        <input
          type="number"
          min={1}
          max={40}
          value={perPage}
          onChange={(e) => setPerPage(Number(e.target.value))}
          className={`${field} w-28`}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-stone-400">
          Generates QR labels (code printed below) for all {count} active book(s).
        </p>
        <DownloadButton
          url={`/api/library/labels?perPage=${perPage}`}
          filename="library-labels.pdf"
          disabled={count === 0}
          className="rounded-lg bg-stone-900 px-5 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
        >
          ⤓ Download labels PDF
        </DownloadButton>
      </div>
    </div>
  );
}
