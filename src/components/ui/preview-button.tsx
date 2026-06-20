"use client";

import { useState } from "react";

// Opens a PDF/document URL in a new tab so the user can preview it inline
// before deciding to print or save. Unlike `<a target="_blank">`, this
// fetches the resource into a blob first so server-side errors (404, 500,
// "No students found", etc.) surface in the UI instead of leaving the new
// tab blank. Pairs with <DownloadButton/>.
export function PreviewButton({
  url,
  children,
  className,
  disabled,
}: {
  url: string;
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
        let message = `Preview failed (${res.status}).`;
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
      // Open in a new tab. Browsers preview PDFs inline; for other types the
      // tab falls back to the browser's download UI.
      window.open(objectUrl, "_blank", "noopener");
      // Don't revoke immediately — give the new tab time to load. A short
      // timeout keeps cleanup tidy without racing the navigation.
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed.");
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
        {busy ? "Opening…" : children}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
