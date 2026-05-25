"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  invoiceId: string;
  status: "pending" | "partial" | "paid" | "void";
  paymentMode: string | null;
};

export default function ReceiptStatus({ invoiceId, status, paymentMode }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const markDone = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paid" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not update status");
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const isDone = status === "paid";
  const isPending = status === "pending";

  return (
    <div className="flex items-center gap-3">
      <StatusBadge status={status} />
      {isPending && (
        <button
          type="button"
          onClick={markDone}
          disabled={saving}
          className="rounded-lg border border-emerald-600 bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Mark as Done"}
        </button>
      )}
      {isDone && paymentMode === "cheque" && (
        <span className="text-xs text-stone-400">Cheque cleared · locked</span>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    paid: { label: "Done", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    pending: { label: "Pending", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    partial: { label: "Partial", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    void: { label: "Void", cls: "bg-stone-100 text-stone-500 border-stone-200" },
  };
  const s = map[status] ?? map.pending;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.cls}`}
    >
      {s.label}
    </span>
  );
}
