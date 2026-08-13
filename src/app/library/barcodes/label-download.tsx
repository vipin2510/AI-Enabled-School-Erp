"use client";

import { useMemo, useState } from "react";
import { DownloadButton } from "@/components/ui/download-button";

export default function LabelDownload({ count, batchSize }: { count: number; batchSize: number }) {
  const [perPage, setPerPage] = useState(12);
  const [batchIndex, setBatchIndex] = useState(0);
  const [search, setSearch] = useState("");
  const field = "rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900";

  const trimmed = search.trim();
  const batchCount = Math.max(1, Math.ceil(count / batchSize));
  const batches = useMemo(
    () =>
      Array.from({ length: batchCount }, (_, i) => {
        const from = i * batchSize + 1;
        const to = Math.min((i + 1) * batchSize, count);
        return { i, label: `Books ${from}–${to}` };
      }),
    [batchCount, batchSize, count]
  );

  const url = trimmed
    ? `/api/library/labels?perPage=${perPage}&q=${encodeURIComponent(trimmed)}`
    : `/api/library/labels?perPage=${perPage}&offset=${batchIndex * batchSize}`;

  return (
    <div className="card space-y-4 p-5">
      <div className="flex flex-wrap gap-4">
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
        <div className="min-w-56">
          <label className="mb-1 block text-xs font-medium text-stone-600">Search (title or code)</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Leave blank to print by batch"
            className={`${field} w-full`}
          />
        </div>
        {!trimmed && (
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">Batch</label>
            <select
              value={batchIndex}
              onChange={(e) => setBatchIndex(Number(e.target.value))}
              className={field}
              disabled={count === 0}
            >
              {batches.map((b) => (
                <option key={b.i} value={b.i}>
                  {b.label} · {b.i + 1} of {batchCount}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-stone-400">
          {trimmed
            ? `Prints up to ${batchSize} labels matching “${trimmed}”.`
            : count > batchSize
            ? `${count} active books — print ${batchSize} at a time using the batch picker.`
            : `Generates QR labels (code printed below) for all ${count} active book(s).`}
        </p>
        <DownloadButton
          url={url}
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
