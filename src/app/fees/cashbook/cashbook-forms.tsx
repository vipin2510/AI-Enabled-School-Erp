"use client";

import { useActionState, useEffect, useRef } from "react";
import { addExpense, addDeposit, setOpeningBalance, type CashbookState } from "./actions";

const inputCls = "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-stone-600">{label}</span>
      {children}
    </label>
  );
}

// Record an expense against the selected day.
export function ExpenseForm({ day }: { day: string }) {
  const [state, action, pending] = useActionState<CashbookState, FormData>(addExpense, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.success) ref.current?.reset(); }, [state?.success]);

  return (
    <form ref={ref} action={action} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Amount (₹) *">
          <input name="amount" type="number" min={1} step={1} required inputMode="numeric" placeholder="e.g. 500" className={inputCls} />
        </Field>
        <Field label="Mode *">
          <select name="mode" defaultValue="cash" className={inputCls}>
            <option value="cash">Cash</option>
            <option value="cheque">Cheque</option>
            <option value="upi">UPI</option>
            <option value="inb">Internet Banking</option>
          </select>
        </Field>
        <Field label="Date *">
          <input name="spent_on" type="date" required defaultValue={day} className={inputCls} />
        </Field>
        <Field label="Category">
          <input name="category" placeholder="Stationery, repairs…" className={inputCls} />
        </Field>
      </div>
      <Field label="Description *">
        <input name="description" required placeholder="What was it for?" className={inputCls} />
      </Field>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-emerald-700">{state.success}</p>}
      <div className="flex justify-end">
        <button type="submit" disabled={pending} className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-stone-50 disabled:opacity-60">
          {pending ? "Saving…" : "Add expense"}
        </button>
      </div>
    </form>
  );
}

// Record a bank deposit (cash taken out of hand to the bank).
export function DepositForm({ day }: { day: string }) {
  const [state, action, pending] = useActionState<CashbookState, FormData>(addDeposit, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.success) ref.current?.reset(); }, [state?.success]);

  return (
    <form ref={ref} action={action} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Amount (₹) *">
          <input name="amount" type="number" min={1} step={1} required inputMode="numeric" placeholder="e.g. 20000" className={inputCls} />
        </Field>
        <Field label="Date *">
          <input name="deposited_on" type="date" required defaultValue={day} className={inputCls} />
        </Field>
        <Field label="Bank">
          <input name="bank_name" placeholder="Bank / branch" className={inputCls} />
        </Field>
        <Field label="Deposit receipt #">
          <input name="deposit_receipt_no" placeholder="Slip / receipt no." className={inputCls} />
        </Field>
        <Field label="Reference">
          <input name="reference" placeholder="Txn / UTR ref" className={inputCls} />
        </Field>
        <Field label="Notes">
          <input name="notes" placeholder="Optional" className={inputCls} />
        </Field>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-emerald-700">{state.success}</p>}
      <div className="flex justify-end">
        <button type="submit" disabled={pending} className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-stone-50 disabled:opacity-60">
          {pending ? "Saving…" : "Add deposit"}
        </button>
      </div>
    </form>
  );
}

// Admin-only: set the opening cash balance anchor (e.g. 1 April).
export function OpeningBalanceForm({
  currentBalance,
  currentDate,
}: {
  currentBalance: number;
  currentDate: string | null;
}) {
  const [state, action, pending] = useActionState<CashbookState, FormData>(setOpeningBalance, undefined);
  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Opening cash balance (₹) *">
          <input name="opening_balance" type="number" min={0} step={1} required inputMode="numeric" defaultValue={currentBalance || ""} placeholder="e.g. 15000" className={inputCls} />
        </Field>
        <Field label="Opening date *">
          <input name="opening_date" type="date" required defaultValue={currentDate ?? ""} className={inputCls} />
        </Field>
      </div>
      <p className="text-xs text-stone-500">
        This anchors the running cash-in-hand. Every later day&apos;s opening is the previous day&apos;s closing.
      </p>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-emerald-700">{state.success}</p>}
      <div className="flex justify-end">
        <button type="submit" disabled={pending} className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-stone-50 disabled:opacity-60">
          {pending ? "Saving…" : "Save opening balance"}
        </button>
      </div>
    </form>
  );
}
