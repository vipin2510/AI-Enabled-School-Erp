"use client";

import { useActionState, useEffect, useRef } from "react";
import { submitExpense, type SubmitState } from "./actions";

const inputCls =
  "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm";

export default function SubmitForm() {
  const [state, formAction, pending] = useActionState<SubmitState, FormData>(
    submitExpense,
    undefined
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Reset on a successful submit so the form is ready for the next entry.
  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state?.success]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Amount (₹) *">
          <input
            name="amount"
            type="number"
            min={1}
            step={1}
            required
            inputMode="numeric"
            placeholder="e.g. 1500"
            className={inputCls}
          />
        </Field>
        <Field label="Category">
          <input
            name="category"
            placeholder="Travel, supplies, repairs…"
            className={inputCls}
          />
        </Field>
        <Field label="Spent on">
          <input name="spent_on" type="date" className={inputCls} />
        </Field>
      </div>
      <Field label="Description *">
        <textarea
          name="description"
          required
          rows={2}
          placeholder="What was the expense for?"
          className={inputCls}
        />
      </Field>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-emerald-700">{state.success}</p>}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-stone-50 disabled:opacity-60"
        >
          {pending ? "Submitting…" : "Submit for approval"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-stone-600">{label}</span>
      {children}
    </label>
  );
}
