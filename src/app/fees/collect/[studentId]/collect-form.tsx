"use client";

import { useMemo, useRef, useState } from "react";
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
  // Calendar-month indexes (1..12) that already have a paid bus-fee item
  // for this student in the current AY — used to lock those months in the
  // Bus Fees card.
  paidBusMonths: number[];
  lateFeeSettings: {
    per_day_amount: number;
    grace_days: number;
    is_enabled: boolean;
    monthly_due_day: number;
  };
  isNewAdmission: boolean;
  // Drives auto-waive policy:
  //   rte         → every selected item is auto-waived (receipt prints ₹0)
  //   staff_child → only monthly (tuition) is charged; rest is auto-waived
  //   regular     → no override; cashier toggles waivers manually
  studentCategory: "regular" | "rte" | "staff_child";
  // Per-month bus fee from the student's profile. null = no bus service.
  busFeeAmount: number | null;
};

// Synthetic component id prefix used for Bus Fee rows so they ride the
// same `selected` state as real fee_structure_components. On submit we
// translate these back to `component_id: null` items.
const BUS_ID_PREFIX = "bus:";
const isBusComponent = (c: Component) => c.id.startsWith(BUS_ID_PREFIX);

// School-year order: Apr (4) → Mar (3) wrapping through the calendar year.
const BUS_SCHOOL_YEAR = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3] as const;
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Registration & new-admission charges only apply on a student's first year.
// Once they're an existing ("old") student we hide them so they can never be
// charged again, and the Outstanding calc never accidentally counts them.
const NEW_ADMISSION_ONLY_KINDS = new Set<FeeKind>([
  "registration",
  "admission_one_time",
]);

// The session opens fees collection from May onward — April's monthly slot is
// hidden because rosters aren't finalised yet at the start of the academic
// year. (period_index uses calendar months: 4 = April.)
const HIDDEN_MONTHLY_PERIODS = new Set<number>([4]);
const isHiddenMonthly = (c: Component) =>
  c.kind === "monthly" && c.period_index !== null && HIDDEN_MONTHLY_PERIODS.has(c.period_index);

// 24 chars of url-safe random, enough to make collisions astronomically rare
// across the school's annual receipt volume.
function newIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function todayLocalIso() {
  const d = new Date();
  const tz = d.getTimezoneOffset();
  const local = new Date(d.getTime() - tz * 60_000);
  return local.toISOString().slice(0, 10);
}

type SelectedItem = {
  component: Component;
  scope: "school" | "hostel" | "bus";
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
  paidBusMonths,
  lateFeeSettings,
  isNewAdmission,
  studentCategory,
  busFeeAmount,
}: Props) {
  // True for any item that's not chargeable for this student. RTE → all;
  // staff child → everything except `monthly` (tuition); regular → none.
  const isAutoWaived = (c: Component): boolean => {
    if (studentCategory === "rte") return true;
    if (studentCategory === "staff_child") return c.kind !== "monthly";
    return false;
  };
  const autoWaiverReason =
    studentCategory === "rte"
      ? "RTE — no fee charged"
      : studentCategory === "staff_child"
        ? "Staff child — only tuition charged"
        : null;
  const router = useRouter();
  const paidSet = useMemo(() => new Set(paidComponentIds), [paidComponentIds]);
  const paidBusSet = useMemo(() => new Set(paidBusMonths), [paidBusMonths]);

  const isApplicable = (c: Component) =>
    (isNewAdmission || !NEW_ADMISSION_ONLY_KINDS.has(c.kind)) && !isHiddenMonthly(c);

  const busAvailable = busFeeAmount != null && busFeeAmount > 0;

  // Synthetic Bus Fee components — one per school-year month, sourced from
  // the per-student bus_fee_amount. They flow through the same `selected`
  // state as real components; on submit we strip the synthetic id and send
  // component_id: null. April is hidden via HIDDEN_MONTHLY_PERIODS just
  // like school monthlies.
  const busComponents = useMemo<Component[]>(() => {
    if (!busAvailable) return [];
    return BUS_SCHOOL_YEAR.map((m, i) => ({
      id: `${BUS_ID_PREFIX}${m}`,
      kind: "monthly" as FeeKind,
      label: `Bus Fee — ${MONTH_NAMES[m - 1]}`,
      period_index: m,
      amount: busFeeAmount ?? 0,
      due_date: null,
      is_refundable: false,
      is_one_time: false,
      sort_order: i,
    }));
  }, [busAvailable, busFeeAmount]);

  const [selected, setSelected] = useState<Record<string, SelectedItem>>({});
  const [showHostel, setShowHostel] = useState(hostelDefaultOpen);
  const [showBus, setShowBus] = useState(busAvailable);
  const [lateFeeWaived, setLateFeeWaived] = useState(false);
  const [waiverReason, setWaiverReason] = useState("");
  const [paymentMode, setPaymentMode] = useState("cash");
  const [paymentRef, setPaymentRef] = useState("");
  const [notes, setNotes] = useState("");
  const [createdBy, setCreatedBy] = useState("");
  const [paidAt, setPaidAt] = useState<string>(todayLocalIso());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // One idempotency key per Collect click. Re-rolls on success or after an
  // error so retries from a stale form don't accidentally collapse with a
  // future, intentional second collection.
  const idempotencyKey = useRef<string>(newIdempotencyKey());

  const newItem = (c: Component, scope: "school" | "hostel" | "bus"): SelectedItem => ({
    component: c,
    scope,
    waived: isAutoWaived(c),
  });

  const toggleItem = (c: Component, scope: "school" | "hostel" | "bus") => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[c.id]) delete next[c.id];
      else next[c.id] = newItem(c, scope);
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
        if (!isApplicable(c)) continue;
        if (!next[c.id]) next[c.id] = newItem(c, struct.scope);
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
        if (!isApplicable(c)) continue;
        // Skip refundable caution at "full year" default? Keep it included as caution is one-time too.
        if (!next[c.id]) next[c.id] = newItem(c, struct.scope);
      }
      return next;
    });
  };

  const selectAllBusMonths = () => {
    setSelected((prev) => {
      const next = { ...prev };
      for (const c of busComponents) {
        if (paidBusSet.has(c.period_index ?? -1)) continue;
        if (isHiddenMonthly(c)) continue;
        if (!next[c.id]) next[c.id] = newItem(c, "bus");
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

  // Toggle the Bus Fees section. Closing drops any selected bus items so
  // the payable total reflects what's visible — same pattern as hostel.
  const toggleBus = () => {
    setShowBus((open) => {
      if (open) {
        setSelected((prev) => {
          const next = { ...prev };
          for (const [id, item] of Object.entries(prev)) {
            if (item.scope === "bus") delete next[id];
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
  const nonBusItems = items.filter((i) => !isBusComponent(i.component));
  const busItems = items.filter((i) => isBusComponent(i.component));
  const subtotalItems = nonBusItems
    .filter((i) => !i.waived)
    .reduce((s, i) => s + Number(i.component.amount), 0);
  const waiverAmount = items
    .filter((i) => i.waived)
    .reduce((s, i) => s + Number(i.component.amount), 0);

  const busMonthsSelected = busItems.filter((i) => !i.waived);
  const busAmount = busMonthsSelected.reduce((s, i) => s + Number(i.component.amount), 0);
  const subtotal = subtotalItems + busAmount;

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
      type ApiItem = {
        component_id: string | null;
        description: string;
        kind: FeeKind;
        period_index: number | null;
        amount: number;
        waived: boolean;
        waiver_reason: string | null;
      };
      // Bus items live as standalone invoice items (component_id: null) so
      // they aren't tied to a fee_structure_components row. Real fee items
      // pass through their component id unchanged. Auto-waive reason wins
      // over the manual one so RTE/staff-child receipts always cite policy.
      const apiItems: ApiItem[] = items.map((i) => {
        const policyReason = isAutoWaived(i.component) ? autoWaiverReason : null;
        return {
          component_id: isBusComponent(i.component) ? null : i.component.id,
          description: i.component.label,
          kind: i.component.kind,
          period_index: i.component.period_index,
          amount: Number(i.component.amount),
          waived: i.waived,
          waiver_reason: i.waived ? policyReason ?? waiverReason ?? null : null,
        };
      });
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentId,
          academic_year: academicYear,
          items: apiItems,
          subtotal,
          late_fee: lateFee,
          waiver_amount: waiverAmount,
          total,
          late_fee_waived: lateFeeWaived,
          waiver_reason:
            waiverAmount > 0 ? waiverReason || autoWaiverReason || null : null,
          payment_mode: paymentMode,
          payment_ref: paymentRef || null,
          notes: notes || null,
          created_by: createdBy || null,
          paid_at: paidAt,
          idempotency_key: idempotencyKey.current,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to record payment");
      router.push(`/receipts/${json.id}`);
    } catch (e: unknown) {
      // New attempt = new key, so a failed-then-retried collect doesn't get
      // squashed by the idempotency check.
      idempotencyKey.current = newIdempotencyKey();
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const renderStruct = (struct: Structure, title: string) => {
    if (!struct) return null;
    const applicable = struct.fee_structure_components.filter(isApplicable);
    const monthly = applicable.filter((c) => c.kind === "monthly");
    const instalments = applicable.filter((c) => c.kind === "instalment");
    const oneTimes = applicable.filter(
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
        {studentCategory === "rte" && (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm">
            <div className="font-semibold text-emerald-900">
              RTE student — no fee charged.
            </div>
            <p className="mt-1 text-xs text-emerald-800">
              Any item you tick is auto-waived. The receipt prints with all amounts at ₹0.
            </p>
          </div>
        )}
        {studentCategory === "staff_child" && (
          <div className="rounded-lg border border-sky-300 bg-sky-50 px-4 py-3 text-sm">
            <div className="font-semibold text-sky-900">
              Staff child — only tuition (monthly) is collected.
            </div>
            <p className="mt-1 text-xs text-sky-800">
              Registration, admission, caution and yearly are auto-waived when ticked.
            </p>
          </div>
        )}
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

        {busAvailable &&
          (showBus ? (
            <div className="space-y-2">
              <BusFeesCard
                components={busComponents}
                selected={selected}
                paidBusSet={paidBusSet}
                busFeeAmount={busFeeAmount as number}
                onToggle={(c) => toggleItem(c, "bus")}
                onSelectAll={selectAllBusMonths}
                isHidden={isHiddenMonthly}
              />
              <button
                type="button"
                onClick={toggleBus}
                className="text-sm text-stone-500 hover:text-stone-900"
              >
                Remove bus fees
              </button>
            </div>
          ) : (
            <Button variant="secondary" type="button" onClick={toggleBus}>
              + Add bus fees
            </Button>
          ))}
      </div>

      <aside className="space-y-4">
        <div className="card p-5 space-y-3 sticky top-6">
          <h3 className="font-medium">Payment Summary</h3>
          <div className="text-sm space-y-1.5">
            <Row label={`Items selected`} value={String(items.length)} />
            <Row label="Subtotal" value={inr(subtotalItems)} />
            {busAvailable && (
              <Row
                label={
                  busMonthsSelected.length > 0
                    ? `Bus Fee (${busMonthsSelected.length} × ${inr(busFeeAmount as number)})`
                    : "Bus Fee"
                }
                value={busMonthsSelected.length > 0 ? inr(busAmount) : "—"}
                muted={busMonthsSelected.length === 0}
              />
            )}
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
            {busAvailable && (
              <p className="text-xs text-stone-500">
                Bus ₹{busFeeAmount}/month — open <strong>Add bus fees</strong>{" "}
                and tick the months this student rode for.
              </p>
            )}

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

            <div>
              <label className="block text-xs text-stone-500 mb-1">Paid on</label>
              <Input
                type="date"
                value={paidAt}
                max={todayLocalIso()}
                onChange={(e) => setPaidAt(e.target.value)}
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
  scope: "school" | "hostel" | "bus";
  selected: Record<string, SelectedItem>;
  paidSet: Set<string>;
  onToggle: (c: Component, scope: "school" | "hostel" | "bus") => void;
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
                <div className="mt-1 ml-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
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

// Dedicated Bus Fees card — mirrors the hostel section UX but uses
// synthetic components built from the student's per-month bus_fee_amount.
// April is hidden (rosters not finalised early in the AY); months with
// already-paid bus invoices show as locked.
function BusFeesCard({
  components,
  selected,
  paidBusSet,
  busFeeAmount,
  onToggle,
  onSelectAll,
  isHidden,
}: {
  components: Component[];
  selected: Record<string, SelectedItem>;
  paidBusSet: Set<number>;
  busFeeAmount: number;
  onToggle: (c: Component) => void;
  onSelectAll: () => void;
  isHidden: (c: Component) => boolean;
}) {
  const visible = components.filter((c) => !isHidden(c));
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-medium">Bus Fees</h3>
          <p className="text-xs text-stone-500">
            {inr(busFeeAmount)} / month — pick the months to collect for.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" type="button" onClick={onSelectAll}>
            All months
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {visible.map((c) => {
          const month = c.period_index as number;
          const isPaid = paidBusSet.has(month);
          const isSelected = !!selected[c.id];
          return (
            <div
              key={c.id}
              className={`rounded-lg border px-3 py-2 transition ${
                isPaid
                  ? "border-stone-200 bg-stone-50 text-stone-400"
                  : isSelected
                    ? "border-stone-900 bg-stone-50"
                    : "border-stone-200 bg-white hover:border-stone-400"
              }`}
            >
              <label className="flex items-center justify-between gap-2 cursor-pointer">
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={isPaid}
                    onChange={() => onToggle(c)}
                    className="h-4 w-4 accent-stone-900"
                  />
                  <span className="text-sm">
                    {MONTH_NAMES[month - 1]}
                    {isPaid && <span className="ml-2 text-xs text-stone-400">(paid)</span>}
                  </span>
                </span>
                <span className="text-sm font-medium">{inr(busFeeAmount)}</span>
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
