"use client";

import { useActionState } from "react";
import { importBooksCsv, type ImportBooksState } from "../actions";

export default function BookImport() {
  const [state, action, pending] = useActionState<ImportBooksState, FormData>(importBooksCsv, undefined);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input
        type="file"
        name="file"
        accept=".csv,.xlsx,.xls"
        required
        className="text-sm file:mr-2 file:rounded-lg file:border-0 file:bg-stone-900 file:px-3 file:py-2 file:text-sm file:text-white"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Importing…" : "Import CSV"}
      </button>
      {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
      {state?.imported !== undefined && (
        <span className="text-sm text-green-700">
          Imported {state.imported} book(s){state.skipped ? ` · ${state.skipped} skipped` : ""}.
        </span>
      )}
    </form>
  );
}
