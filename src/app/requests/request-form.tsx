"use client";

import { useActionState, useRef, useEffect } from "react";
import { submitRequest, type RequestState } from "./actions";

export default function RequestForm() {
  const [state, action, pending] = useActionState<RequestState, FormData>(
    submitRequest,
    undefined
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state?.success]);

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <input
        name="subject"
        placeholder="Subject (e.g. Correct a fee amount for class 5)"
        required
        className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
      />
      <textarea
        name="body"
        placeholder="Describe the change you need…"
        required
        rows={4}
        className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
      />
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-emerald-700">{state.success}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-stone-50 disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send request"}
      </button>
    </form>
  );
}
