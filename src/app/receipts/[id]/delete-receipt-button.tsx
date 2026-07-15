"use client";

import { deleteReceipt } from "../actions";

// Admin-only. Confirms before firing the (irreversible) delete server action.
export function DeleteReceiptButton({ invoiceId }: { invoiceId: string }) {
  return (
    <form
      action={deleteReceipt}
      onSubmit={(e) => {
        if (
          !confirm(
            "Delete this receipt permanently?\n\nThis removes the invoice, its line items and payment records. This cannot be undone."
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={invoiceId} />
      <button className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
        🗑 Delete
      </button>
    </form>
  );
}
