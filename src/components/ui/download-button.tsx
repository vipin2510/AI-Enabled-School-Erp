"use client";

import { useState } from "react";

// Fetches a file (PDF/ZIP/CSV), then triggers a download from a blob URL.
// Unlike window.open / <a target=_blank>, this can't be popup-blocked and it
// surfaces server errors (e.g. "No books to print labels for") inline.
export function DownloadButton({
  url,
  filename,
  children,
  className,
  disabled,
}: {
  url: string;
  filename?: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        let message = `Download failed (${res.status}).`;
        try {
          const j = await res.json();
          if (j?.error) message = j.error;
        } catch {
          /* not JSON */
        }
        throw new Error(message);
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      if (filename) a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={run}
        disabled={busy || disabled}
        className={className}
      >
        {busy ? "Preparing…" : children}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
