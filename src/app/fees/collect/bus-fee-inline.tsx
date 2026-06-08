"use client";

import { useActionState, useState } from "react";
import { setBusFee, type SetBusFeeState } from "./actions";

// Compact ₹/month input + Save button for inline editing on the Collect Fee
// picker. Clicks here do NOT navigate to the student's collect page (we stop
// propagation), so the row can still wrap the rest of the card in a <Link>.
export default function BusFeeInline({
  studentId,
  initial,
}: {
  studentId: string;
  initial: number | null;
}) {
  const [state, formAction, pending] = useActionState<SetBusFeeState, FormData>(
    setBusFee,
    undefined,
  );
  const [value, setValue] = useState<string>(initial == null ? "" : String(initial));

  const errored = !!state?.error;
  const saved = !!state?.saved;

  return (
    <form
      action={formAction}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className="flex items-center gap-1.5"
      title={state?.error ?? "Per-month bus fee (₹). Empty = no bus."}
    >
      <input type="hidden" name="student_id" value={studentId} />
      <span className="text-xs text-stone-400">Bus ₹</span>
      <input
        name="amount"
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, ""))}
        inputMode="numeric"
        placeholder="—"
        className={`w-16 rounded-md border bg-white px-2 py-1 text-sm tabular-nums ${
          errored ? "border-red-400" : "border-stone-300"
        }`}
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs text-stone-700 hover:bg-stone-50 disabled:opacity-50"
      >
        {pending ? "…" : saved ? "✓" : "Save"}
      </button>
    </form>
  );
}
