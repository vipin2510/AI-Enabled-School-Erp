"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { startDemo } from "@/app/actions/demo";

// Public "See Demo" entry on the login page. Two steps: pick an audience
// (institute now; parent later) then a device. Each device option is a plain
// <form action={startDemo}> with a hidden `device` field — the server action
// provisions the demo and redirects, so no client fetch is needed.
export default function DemoChooser() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [audience, setAudience] = useState<"institute" | "parent" | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 w-full rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
      >
        {t("See Demo")}
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-stone-200 bg-white p-4">
      {audience === null && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-stone-500">{t("Who is this demo for?")}</p>
          <button
            type="button"
            onClick={() => setAudience("institute")}
            className="w-full rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-stone-50 hover:bg-stone-800"
          >
            {t("For an institute")}
          </button>
          <button
            type="button"
            disabled
            className="w-full cursor-not-allowed rounded-lg border border-stone-200 bg-stone-50 px-4 py-2 text-sm font-medium text-stone-400"
          >
            {t("For a parent")} · {t("Coming soon")}
          </button>
        </div>
      )}

      {audience === "institute" && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-stone-500">{t("How do you want to view it?")}</p>
          <div className="grid grid-cols-2 gap-2">
            <form action={startDemo}>
              <input type="hidden" name="device" value="laptop" />
              <DeviceButton label={t("View on laptop")} />
            </form>
            <form action={startDemo}>
              <input type="hidden" name="device" value="mobile" />
              <DeviceButton label={t("View on mobile")} />
            </form>
          </div>
          <button
            type="button"
            onClick={() => setAudience(null)}
            className="mt-1 text-xs text-stone-400 hover:text-stone-600"
          >
            ← {t("Back")}
          </button>
        </div>
      )}
    </div>
  );
}

// Submit button that shows a pending state via the form's own status would need
// useFormStatus; kept simple here — the action redirects on success.
function DeviceButton({ label }: { label: string }) {
  return (
    <button
      type="submit"
      className="w-full rounded-lg bg-stone-900 px-3 py-2 text-sm font-medium text-stone-50 hover:bg-stone-800"
    >
      {label}
    </button>
  );
}
