"use client";

import { useActionState } from "react";
import { issueTc, type TcState } from "../actions";

const inputCls = "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-stone-600">{label}</span>
      {children}
    </label>
  );
}

export default function TcIssueForm({
  studentId,
  isAdmin,
  defaults,
}: {
  studentId: string;
  isAdmin: boolean;
  defaults: { studying_class: string; last_exam_class: string; no_dues_amount: number };
}) {
  const [state, action, pending] = useActionState<TcState, FormData>(issueTc, undefined);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="student_id" value={studentId} />
      <input type="hidden" name="no_dues_amount" value={defaults.no_dues_amount} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Caste"><input name="caste" className={inputCls} /></Field>
        <Field label="Admission date"><input name="admission_date" type="date" className={inputCls} /></Field>
        <Field label="Date of leaving *"><input name="date_of_leaving" type="date" required className={inputCls} /></Field>
        <Field label="School days attended"><input name="school_days_attended" placeholder="e.g. 210" className={inputCls} /></Field>
        <Field label="Studying in class"><input name="studying_class" defaultValue={defaults.studying_class} className={inputCls} /></Field>
        <Field label="Reason for leaving"><input name="reason" placeholder="e.g. relocation" className={inputCls} /></Field>
        <Field label="Last exam result">
          <select name="last_exam_result" defaultValue="Passed" className={inputCls}>
            <option>Passed</option>
            <option>Failed</option>
            <option>Promoted</option>
          </select>
        </Field>
        <Field label="Last exam class"><input name="last_exam_class" defaultValue={defaults.last_exam_class} className={inputCls} /></Field>
        <Field label="Last exam year"><input name="last_exam_year" placeholder="e.g. 2025-26" className={inputCls} /></Field>
        <Field label="Enrolled in class (next)"><input name="promoted_to_class" className={inputCls} /></Field>
        <Field label="Admitted in (session/class)"><input name="admitted_in" className={inputCls} /></Field>
        <Field label="Conduct"><input name="conduct" defaultValue="Good" className={inputCls} /></Field>
      </div>
      <Field label="Remarks"><input name="remarks" className={inputCls} /></Field>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {!isAdmin && <p className="text-sm text-amber-700">Only an admin can issue a TC. You can review the details and no-dues above.</p>}

      <div className="flex justify-end">
        <button type="submit" disabled={pending || !isAdmin} className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-stone-50 disabled:opacity-50">
          {pending ? "Issuing…" : "Issue TC & freeze student"}
        </button>
      </div>
    </form>
  );
}
