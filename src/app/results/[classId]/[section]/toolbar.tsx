"use client";

import { useActionState, useRef, useState } from "react";
import { importMarksCsv, type ImportState } from "../../actions";

type Subject = { id: string; name: string };

type Props = {
  classId: string;
  section: string;
  subjects: Subject[];
  hasStudents: boolean;
};

const qs = (params: Record<string, string>) => new URLSearchParams(params).toString();

export default function ResultsToolbar({ classId, section, subjects, hasStudents }: Props) {
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [state, formAction, pending] = useActionState<ImportState, FormData>(importMarksCsv, undefined);
  const fileRef = useRef<HTMLInputElement>(null);

  const templateHref = `/api/results/template?${qs({ classId, section, subjectId })}`;
  const zipHref = `/api/results/zip?${qs({ classId, section })}`;
  const selectCls =
    "rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900";
  const btn =
    "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:opacity-50";

  return (
    <div className="card p-5">
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Per-subject CSV: download → fill → import */}
        <div>
          <h2 className="text-sm font-semibold text-stone-800">Marks by subject (CSV)</h2>
          <p className="mt-1 text-xs text-stone-500">
            Download a sheet for one subject, fill the exam columns, then import it back.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className={selectCls}
              aria-label="Subject"
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <a
              href={templateHref}
              className={`${btn} border border-stone-200 bg-stone-100 text-stone-900 hover:bg-stone-200 ${
                hasStudents ? "" : "pointer-events-none opacity-50"
              }`}
            >
              ↓ Download CSV
            </a>
          </div>

          <form action={formAction} className="mt-3 flex flex-wrap items-center gap-2">
            <input type="hidden" name="classId" value={classId} />
            <input type="hidden" name="section" value={section} />
            <input type="hidden" name="subjectId" value={subjectId} />
            <input
              ref={fileRef}
              type="file"
              name="file"
              accept=".csv,.xlsx,.xls"
              required
              className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-stone-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-stone-800"
            />
            <button type="submit" disabled={pending} className={`${btn} bg-accent text-white hover:opacity-90`}>
              {pending ? "Importing…" : "Import filled CSV"}
            </button>
          </form>

          {state?.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
          {state?.imported !== undefined && (
            <p className="mt-2 text-sm text-green-700">
              Imported {state.imported} mark{state.imported === 1 ? "" : "s"} for {state.subject}
              {state.skipped ? ` · ${state.skipped} row(s) skipped` : ""}.
            </p>
          )}
        </div>

        {/* Whole-class report cards */}
        <div className="lg:border-l lg:border-stone-100 lg:pl-5">
          <h2 className="text-sm font-semibold text-stone-800">Report cards</h2>
          <p className="mt-1 text-xs text-stone-500">
            Generate a printable report card PDF for every student in this section, bundled as a ZIP.
          </p>
          <a
            href={zipHref}
            className={`${btn} mt-3 bg-stone-900 text-white hover:bg-stone-800 ${
              hasStudents ? "" : "pointer-events-none opacity-50"
            }`}
          >
            ⤓ Download class result ZIP
          </a>
        </div>
      </div>
    </div>
  );
}
