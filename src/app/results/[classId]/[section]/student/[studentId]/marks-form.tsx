"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import {
  EXAMS,
  CO_CURRICULAR_GRADES,
  EXTRA_FIELDS,
  markKey,
  extraKey,
  gradeFor,
  type MarksMap,
  type ExtrasMap,
} from "@/lib/results";
import type { SaveState } from "@/app/results/actions";

type Subject = { id: string; name: string };

type Props = {
  action: (prev: SaveState, formData: FormData) => Promise<SaveState>;
  subjects: Subject[];
  coCurricular: Subject[];
  initial: MarksMap;
  initialGrades: Record<string, string>;
  initialExtras: ExtrasMap;
  backHref: string;
};

export default function StudentMarksForm({
  action,
  subjects,
  coCurricular,
  initial,
  initialGrades,
  initialExtras,
  backHref,
}: Props) {
  const [state, formAction, pending] = useActionState<SaveState, FormData>(action, undefined);

  // Live values keyed "subjectId:exam" → string (raw input).
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const s of subjects) {
      for (const e of EXAMS) {
        const m = initial[markKey(s.id, e.key)];
        v[markKey(s.id, e.key)] = m === null || m === undefined ? "" : String(m);
      }
    }
    return v;
  });

  const set = (key: string, val: string) => setValues((prev) => ({ ...prev, [key]: val }));

  // Per-subject totals + grand totals recomputed on every keystroke.
  const { rowStats, grandTotal, grandMax, columnTotals } = useMemo(() => {
    const rowStats: Record<string, { total: number; max: number; percent: number }> = {};
    const columnTotals: Record<string, number> = {};
    let grandTotal = 0;
    let grandMax = 0;
    for (const s of subjects) {
      let total = 0;
      let max = 0;
      for (const e of EXAMS) {
        const raw = values[markKey(s.id, e.key)];
        const n = raw === "" ? null : Number(raw);
        if (n !== null && Number.isFinite(n)) {
          total += n;
          max += e.max;
          columnTotals[e.key] = (columnTotals[e.key] ?? 0) + n;
        }
      }
      rowStats[s.id] = { total, max, percent: max ? (total / max) * 100 : 0 };
      grandTotal += total;
      grandMax += max;
    }
    return { rowStats, grandTotal, grandMax, columnTotals };
  }, [values, subjects]);

  const grandPercent = grandMax ? (grandTotal / grandMax) * 100 : 0;
  const inputCls =
    "w-16 rounded-md border border-stone-300 bg-white px-2 py-1 text-center text-sm outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900";

  return (
    <form action={formAction}>
      {subjects.length > 0 && (
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Subject</th>
              {EXAMS.map((e) => (
                <th key={e.key} className="px-2 py-3 text-center font-medium">
                  {e.short}
                  <div className="text-[10px] font-normal normal-case text-stone-400">/{e.max}</div>
                </th>
              ))}
              <th className="px-3 py-3 text-right font-medium">Total</th>
              <th className="px-3 py-3 text-center font-medium">Grade</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((s) => {
              const stat = rowStats[s.id];
              return (
                <tr key={s.id} className="border-t border-stone-100">
                  <td className="px-4 py-2 font-medium text-stone-800">{s.name}</td>
                  {EXAMS.map((e) => {
                    const key = markKey(s.id, e.key);
                    return (
                      <td key={e.key} className="px-2 py-2 text-center">
                        <input
                          type="number"
                          name={`m_${s.id}_${e.key}`}
                          min={0}
                          max={e.max}
                          step="0.5"
                          inputMode="decimal"
                          value={values[key] ?? ""}
                          onChange={(ev) => set(key, ev.target.value)}
                          className={inputCls}
                          aria-label={`${s.name} ${e.label}`}
                        />
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right tabular-nums text-stone-700">
                    {stat.max ? `${stat.total}/${stat.max}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {stat.max ? (
                      <span className="inline-flex min-w-[2rem] justify-center rounded-md bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-700">
                        {gradeFor(stat.percent)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-stone-200 bg-stone-50 font-semibold">
              <td className="px-4 py-3 text-stone-700">Grand Total</td>
              {EXAMS.map((e) => (
                <td key={e.key} className="px-2 py-3 text-center tabular-nums text-stone-700">
                  {columnTotals[e.key] ?? 0}
                </td>
              ))}
              <td className="px-3 py-3 text-right tabular-nums text-stone-900">
                {grandTotal}/{grandMax}
              </td>
              <td className="px-3 py-3 text-center text-stone-900">
                {grandMax ? `${grandPercent.toFixed(1)}%` : "—"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      )}

      {coCurricular.length > 0 && (
        <div className="card mt-6 p-5">
          <h2 className="text-sm font-semibold text-stone-800">Co-curricular</h2>
          <p className="mt-1 text-xs text-stone-500">
            Graded A–E. Not counted in the academic percentage.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {coCurricular.map((s) => (
              <label key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 px-3 py-2">
                <span className="text-sm font-medium text-stone-800">{s.name}</span>
                <select
                  name={`g_${s.id}`}
                  defaultValue={initialGrades[s.id] ?? ""}
                  className="rounded-md border border-stone-300 bg-white px-2 py-1 text-sm outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
                >
                  <option value="">—</option>
                  {CO_CURRICULAR_GRADES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Extra assessments — one value per exam, mirrors the marksheet rows. */}
      <div className="card mt-6 overflow-x-auto p-0">
        <div className="px-4 pt-4">
          <h2 className="text-sm font-semibold text-stone-800">Extra assessments</h2>
          <p className="mt-1 text-xs text-stone-500">
            Dictation / handwriting marks, moral-science / drawing / SUPW grades, and
            attendance days — entered per exam, shown below the subjects on the marksheet.
          </p>
        </div>
        <table className="mt-3 w-full text-sm">
          <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Item</th>
              {EXAMS.map((e) => (
                <th key={e.key} className="px-2 py-3 text-center font-medium">{e.short}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {EXTRA_FIELDS.map((f) => (
              <tr key={f.key} className="border-t border-stone-100">
                <td className="px-4 py-2 font-medium text-stone-800">
                  {f.label}
                  {f.max != null && <span className="ml-1 text-xs text-stone-400">/{f.max}</span>}
                </td>
                {EXAMS.map((e) => {
                  const key = extraKey(f.key, e.key);
                  const cls =
                    "w-16 rounded-md border border-stone-300 bg-white px-2 py-1 text-center text-sm outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900";
                  return (
                    <td key={e.key} className="px-2 py-2 text-center">
                      {f.kind === "grade" ? (
                        <select
                          name={`x_${f.key}_${e.key}`}
                          defaultValue={initialExtras[key] ?? ""}
                          className={cls}
                          aria-label={`${f.label} ${e.short}`}
                        >
                          <option value="">—</option>
                          {CO_CURRICULAR_GRADES.map((g) => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="number"
                          name={`x_${f.key}_${e.key}`}
                          min={0}
                          max={f.kind === "marks" ? f.max : undefined}
                          step={f.kind === "count" ? 1 : "0.5"}
                          inputMode="decimal"
                          defaultValue={initialExtras[key] ?? ""}
                          className={cls}
                          aria-label={`${f.label} ${e.short}`}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {state?.error && <p className="mt-3 text-sm text-red-600">{state.error}</p>}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-stone-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save marks"}
        </button>
        <Link
          href={backHref}
          className="rounded-lg border border-stone-200 bg-stone-100 px-4 py-2 text-sm text-stone-900 hover:bg-stone-200"
        >
          Cancel
        </Link>
        <span className="ml-auto text-xs text-stone-400">
          Leave a cell blank for not-yet-taken / absent.
        </span>
      </div>
    </form>
  );
}
