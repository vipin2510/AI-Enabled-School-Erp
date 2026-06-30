"use client";

import { useT } from "@/lib/i18n/client";
import { startDemo } from "@/app/actions/demo";

// "See Demo" entry. Submitting provisions the demo session, then the server
// action redirects: desktop/tablet → the full /demo selection page (laptop +
// mobile live previews); a real phone → straight into the full-screen app.
export default function DemoChooser() {
  const t = useT();
  return (
    <form action={startDemo}>
      <button
        type="submit"
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
      >
        ✨ {t("See Demo")}
      </button>
    </form>
  );
}
