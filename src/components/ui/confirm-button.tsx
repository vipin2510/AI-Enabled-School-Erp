"use client";

import { useState } from "react";
import { Modal } from "./modal";

// A destructive-action trigger that asks for confirmation in a modal before
// submitting `action` (a server action) with the given hidden fields.
export function ConfirmButton({
  action,
  fields,
  label,
  confirmLabel = "Delete",
  title = "Are you sure?",
  message,
  className,
  disabled,
}: {
  action: (formData: FormData) => void | Promise<void>;
  fields: Record<string, string>;
  label: React.ReactNode;
  confirmLabel?: string;
  title?: string;
  message: string;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className={className ?? "text-red-600 hover:underline disabled:opacity-40"}
      >
        {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title}>
        <p className="text-sm text-stone-600">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg border border-stone-200 bg-stone-100 px-4 py-2 text-sm text-stone-900 hover:bg-stone-200"
          >
            Cancel
          </button>
          <form action={action}>
            {Object.entries(fields).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
            <button
              type="submit"
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              {confirmLabel}
            </button>
          </form>
        </div>
      </Modal>
    </>
  );
}
