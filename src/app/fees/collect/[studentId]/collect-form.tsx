"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Toggle } from "@/components/ui/toggle";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { inr, daysBetween } from "@/lib/utils";
import type { FeeKind } from "@/lib/types";

type Component = {
  id: string;
  kind: FeeKind;
  label: string;
  period_index: number | null;
  amount: number;
  due_date: string | null;
  is_refundable: boolean;
  is_one_time: boolean;
  sort_order: number;
};

type Structure = {
  id: string;
  scope: "school" | "hostel";
  student_kind: "new" | "old" | "any";
  total_amount: number;
  fee_structure_components: Component[];
} | null;

type Props = {
  studentId: string;
  studentName: string;
  academicYear: string;
  schoolStruct: Structure;
  hostelStruct: Structure;
  hostelDefaultOpen: boolean;
  paidComponentIds: string[];
  lateFeeSettings: {
    per_day_amount: number;
    grace_days: number;
    is_enabled: boolean;
    monthly_due_day: number;
  };
};

type SelectedItem = {
  component: Component;
  scope: "school" | "hostel";
  waived: boolean;
};

export default function CollectForm({
  studentId,
  studentName,
  academicYear,
  schoolStruct,
  hostelStruct,
  hostelDefaultOpen,
  paidComponentIds,
  lateFeeSettings,
}: Props) {
  const router = useRouter();
  const paidSet = useMemo(() => new Set(paidComponentIds), [paidComponentIds]);

  const [selected, setSelected] = useState<Record<string, SelectedItem>>({});
  const [showHostel, setShowHostel] = useState(hostelDefaultOpen);
  const [lateFeeWaived, setLateFeeWaived] = useState(false);
  const [waiverReason, setWaiverReason] = useState("");
  const [paymentMode, setPaymentMode] = useState("cash");
  const [paymentRef, setPaymentRef] = useState("");
  const [notes, setNotes] = useState("");
  const [createdBy, setCreatedBy] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleItem = (c: Component, scope: "school" | "hostel") => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[c.id]) delete next[c.id];
      else next[c.id] = { component: c, scope, waived: false };
      return next;
    });
  };

  const toggleWaiver = (componentId: string) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[componentId]) next[componentId] = { ...next[componentId], waived: !next[componentId].waived };
      return next;
    });
  };

  const selectAllOfKind = (struct: Structure, kind: FeeKind) => {
    if (!struct) return;
    setSelected((prev) => {
      const next = { ...prev };
      for (const c of struct.fee_structure_components) {
        if (c.kind !== kind) continue;
        if (paidSet.has(c.id)) continue;
        if (!next[c.id]) next[c.id] = { component: c, scope: struct.scope, waived: false };
      }
      return next;
    });
  };

  const selectFullYear = (struct: Structure) => {
    if (!struct) return;
    setSelected((prev) => {
      const next = { ...prev };
      for (const c of struct.fee_structure_components) {
        if (paidSet.has(c.id)) continue;
        // Skip refundable caution at "full year" default? Keep it included as caution is one-time too.
        if (!next[c.id]) next[c.id] = { component: c, scope: struct.scope, waived: false };
      }
      return next;
    });
  };

  const clearAll = () => setSelected({});

  const toggleHostel = () => {
    setShowHostel((open) => {
      if (open) {
        // Hiding hostel: drop any selected hostel items so totals stay correct.
        setSelected((prev) => {
          const next = { ...prev };
          for (const [id, item] of Object.entries(prev)) {
            if (item.scope === "hostel") delete next[id];
          }
          return next;
        });
      }
      return !open;
    });
  };

  // --- Totals ---
  const today = new Date();
  const items = Object.values(selected);
  const subtotal = items
    .filter((i) => !i.waived)
    .reduce((s, i) => s + Number(i.component.amount), 0);
  const waiverAmount = items
    .filter((i) => i.waived)
    .reduce((s, i) => s + Number(i.component.amount), 0);

  // Late fee: per-day from settings × days past due (only for items with a due_date that's past).
  // For monthly fees the due day comes from the configurable "last fee date of the month".
  const lateFeePerComponent = items.map((i) => {
    if (i.waived || !lateFeeSettings.is_enabled || !i.component.due_date) return 0;
    const due = new Date(i.component.due_date);
    if (i.component.kind === "monthly") {
      due.setDate(lateFeeSettings.monthly_due_day);
    }
    const diff = daysBetween(due, today) - lateFeeSettings.grace_days;
    if (diff <= 0) return 0;
    return diff * Number(lateFeeSettings.per_day_amount);
  });
  const lateFeeRaw = lateFeePerComponent.reduce((s, n) => s + n, 0);
  const lateFee = lateFeeWaived ? 0 : lateFeeRaw;

  const total = subtotal + lateFee;

  // --- Submit ---
  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentId,
          academic_year: academicYear,
          items: items.map((i) => ({
            component_id: i.component.id,
            description: i.component.label,
            kind: i.component.kind,
            period_index: i.component.period_index,
            amount: Number(i.component.amount),
            waived: i.waived,
            waiver_reason: i.waived ? waiverReason || null : null,
          })),
          subtotal,
          late_fee: lateFee,
          waiver_amount: waiverAmount,
          total,
          late_fee_waived: lateFeeWaived,
          waiver_reason: waiverAmount > 0 ? waiverReason || null : null,
          payment_mode: paymentMode,
          payment_ref: paymentRef || null,
          notes: notes || null,
          created_by: createdBy || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to record payment");
      router.push(`/receipts/${json.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const renderStruct = (struct: Structure, title: string) => {
    if (!struct) return null;
    const monthly = struct.fee_structure_components.filter((c) => c.kind === "monthly");
    const instalments = struct.fee_structure_components.filter((c) => c.kind === "instalment");
    const oneTimes = struct.fee_structure_components.filter(
      (c) => c.is_one_time || ["registration", "caution", "yearly", "admission_one_time"].includes(c.kind)
    );

    return (
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium">{title}</h3>
          <div className="flex gap-2">
            <Button variant="secondary" type="button" onClick={() => selectFullYear(struct)}>
              Pay full year
            </Button>
            {monthly.length > 0 && (
              <Button variant="secondary" type="button" onClick={() => selectAllOfKind(struct, "monthly")}>
                All months
              </Button>
            )}
            {instalments.length > 0 && (
              <Button variant="secondary" type="button" onClick={() => selectAllOfKind(struct, "instalment")}>
                All instalments
              </Button>
            )}
          </div>
        </div>

        {oneTimes.length > 0 && (
          <ComponentGroup
            label="One-time / yearly"
            components={oneTimes}
            scope={struct.scope}
            selected={selected}
            paidSet={paidSet}
            onToggle={toggleItem}
            onToggleWaiver={toggleWaiver}
          />
        )}
        {instalments.length > 0 && (
          <ComponentGroup
            label="Instalments"
            components={instalments}
            scope={struct.scope}
            selected={selected}
            paidSet={paidSet}
            onToggle={toggleItem}
            onToggleWaiver={toggleWaiver}
          />
        )}
        {monthly.length > 0 && (
          <ComponentGroup
            label="Monthly"
            components={monthly}
            scope={struct.scope}
            selected={selected}
            paidSet={paidSet}
            onToggle={toggleItem}
            onToggleWaiver={toggleWaiver}
            columns={3}
          />
        )}
      </div>
    );
  };

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-6">
      <div className="space-y-6">
        {renderStruct(schoolStruct, "School Fees")}
        {!schoolStruct && (
          <div className="card p-5 text-sm text-stone-500">
            No school fee structure found for this class. Set one up in Fee Structures.
          </div>
        )}

        {hostelStruct &&
          (showHostel ? (
            <div className="space-y-2">
              {renderStruct(hostelStruct, "Hostel Fees")}
              <button
                type="button"
                onClick={toggleHostel}
                className="text-sm text-stone-500 hover:text-stone-900"
              >
                Remove hostel fees
              </button>
            </div>
          ) : (
            <Button variant="secondary" type="button" onClick={toggleHostel}>
              + Add hostel fees
            </Button>
          ))}
      </div>

      <aside className="space-y-4">
        <div className="card p-5 space-y-3 sticky top-6">
          <h3 className="font-medium">Payment Summary</h3>
          <div className="text-sm space-y-1.5">
            <Row label={`Items selected`} value={String(items.length)} />
            <Row label="Subtotal" value={inr(subtotal)} />
            {waiverAmount > 0 && (
              <Row label="Waived (items)" value={`− ${inr(waiverAmount)}`} muted />
            )}
            <Row
              label={`Late fee${lateFeeSettings.is_enabled ? ` (₹${lateFeeSettings.per_day_amount}/day)` : ""}`}
              value={lateFeeWaived ? `− ${inr(lateFeeRaw)} (waived)` : inr(lateFee)}
              muted={lateFeeWaived}
            />
            <div className="border-t border-stone-200 my-2" />
            <Row label="Payable" value={inr(total)} bold />
          </div>

          <div className="pt-2 space-y-3">
            <Toggle
              checked={lateFeeWaived}
              onChange={setLateFeeWaived}
              label="Waive off late fee"
              description={lateFeeRaw > 0 ? `Save ${inr(lateFeeRaw)}` : "No late fee accrued"}
              disabled={lateFeeRaw === 0}
            />

            {(waiverAmount > 0 || items.some((i) => i.waived)) && (
              <Input
                placeholder="Reason for waiver (printed on receipt)"
                value={waiverReason}
                onChange={(e) => setWaiverReason(e.target.value)}
              />
            )}

            <div className="grid grid-cols-2 gap-2">
              <Select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
                <option value="bank">Bank Transfer</option>
                <option value="cheque">Cheque</option>
              </Select>
              <Input
                placeholder="Txn / cheque #"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
              />
            </div>

            <Input
              placeholder="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <Input
              placeholder="Collected by (your name)"
              value={createdBy}
              onChange={(e) => setCreatedBy(e.target.value)}
            />

            {error && <div className="text-sm text-red-600">{error}</div>}

            <div className="flex gap-2">
              <Button variant="secondary" type="button" onClick={clearAll}>
                Clear
              </Button>
              <Button
                className="flex-1"
                disabled={!items.length || submitting}
                onClick={submit}
                type="button"
              >
                {submitting ? "Saving…" : `Collect ${inr(total)}`}
              </Button>
            </div>
            <p className="text-xs text-stone-500">
              Generates receipt for <strong>{studentName}</strong>.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  bold,
}: {
  label: string;
  value: string;
  muted?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-stone-500">{label}</span>
      <span className={muted ? "text-stone-400" : bold ? "text-lg font-semibold text-stone-900" : "text-stone-900"}>
        {value}
      </span>
    </div>
  );
}

function ComponentGroup({
  label,
  components,
  scope,
  selected,
  paidSet,
  onToggle,
  onToggleWaiver,
  columns = 2,
}: {
  label: string;
  components: Component[];
  scope: "school" | "hostel";
  selected: Record<string, SelectedItem>;
  paidSet: Set<string>;
  onToggle: (c: Component, scope: "school" | "hostel") => void;
  onToggleWaiver: (id: string) => void;
  columns?: number;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="text-xs uppercase tracking-wide text-stone-500 mb-2">{label}</div>
      <div className={`grid gap-2 ${columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {components.map((c) => {
          const isPaid = paidSet.has(c.id);
          const isSelected = !!selected[c.id];
          const waived = selected[c.id]?.waived;
          return (
            <div
              key={c.id}
              className={`rounded-lg border px-3 py-2 transition ${
                isPaid
                  ? "border-stone-200 bg-stone-50 text-stone-400"
                  : isSelected
                    ? waived
                      ? "border-amber-400 bg-amber-50"
                      : "border-stone-900 bg-stone-50"
                    : "border-stone-200 bg-white hover:border-stone-400"
              }`}
            >
              <label className="flex items-center justify-between gap-2 cursor-pointer">
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={isPaid}
                    onChange={() => onToggle(c, scope)}
                    className="h-4 w-4 accent-stone-900"
                  />
                  <span className="text-sm">
                    {c.label}
                    {isPaid && <span className="ml-2 text-xs text-stone-400">(paid)</span>}
                  </span>
                </span>
                <span className={`text-sm font-medium ${waived ? "line-through text-stone-400" : ""}`}>
                  {inr(c.amount)}
                </span>
              </label>
              {isSelected && (
                <div className="mt-1 ml-6 text-xs">
                  <button
                    type="button"
                    onClick={() => onToggleWaiver(c.id)}
                    className="text-stone-500 hover:text-stone-900"
                  >
                    {waived ? "Un-waive" : "Waive this item"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
