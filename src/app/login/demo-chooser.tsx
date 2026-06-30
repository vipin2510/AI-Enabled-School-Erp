"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { startDemo } from "@/app/actions/demo";

const CTA =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90";

// "See Demo" entry on the landing page.
//  • Mobile: one tap straight into the mobile demo (no laptop option to pick).
//  • Desktop: opens a small modal — audience (institute / parent) then device
//    (laptop / mobile). The server action provisions the demo and redirects.
export default function DemoChooser({ isMobile = false }: { isMobile?: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [audience, setAudience] = useState<"institute" | "parent" | null>(null);

  if (isMobile) {
    return (
      <form action={startDemo}>
        <input type="hidden" name="device" value="mobile" />
        <button type="submit" className={CTA}>
          ✨ {t("See Demo")}
        </button>
      </form>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setAudience(null);
          setOpen(true);
        }}
        className={CTA}
      >
        ✨ {t("See Demo")}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold">{t("See Demo")}</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("Close")}
                className="text-stone-400 hover:text-stone-700"
              >
                ✕
              </button>
            </div>

            {audience === null ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-stone-500">{t("Who is this demo for?")}</p>
                <button
                  type="button"
                  onClick={() => setAudience("institute")}
                  className="w-full rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-stone-50 hover:bg-stone-800"
                >
                  {t("For an institute")}
                </button>
                <button
                  type="button"
                  disabled
                  className="w-full cursor-not-allowed rounded-lg border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm font-medium text-stone-400"
                >
                  {t("For a parent")} · {t("Coming soon")}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
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
                  className="text-xs text-stone-400 hover:text-stone-600"
                >
                  ← {t("Back")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function DeviceButton({ label }: { label: string }) {
  return (
    <button
      type="submit"
      className="w-full rounded-lg bg-stone-900 px-3 py-2.5 text-sm font-medium text-stone-50 hover:bg-stone-800"
    >
      {label}
    </button>
  );
}
