"use client";

import { useActionState, useMemo, useState } from "react";
import { saveAttendance, type AttendanceState } from "./actions";

type Student = { id: string; full_name: string; admission_no: string | null };
type Status = "present" | "absent";
// UI-only third state: a day that has no saved record starts "unmarked" so it
// can never be mistaken for (or accidentally submitted as) a fully-present day.
type Mark = Status | "unmarked";

export default function AttendanceForm({
  classId,
  section,
  date,
  students,
  initial,
  alreadyMarked,
}: {
  classId: string;
  section: string;
  date: string;
  students: Student[];
  initial: Record<string, Status>;
  alreadyMarked: boolean;
}) {
  const action = saveAttendance.bind(null, classId, section, date);
  const [state, formAction, pending] = useActionState<AttendanceState, FormData>(action, undefined);

  // For a day that's already been marked, start from the saved record (missing
  // students default present). For a fresh day, start everyone "unmarked" — the
  // marker must make an explicit choice before submitting, so yesterday's data
  // never bleeds onto an untouched date.
  const [marks, setMarks] = useState<Record<string, Mark>>(() => {
    const m: Record<string, Mark> = {};
    for (const s of students) m[s.id] = alreadyMarked ? initial[s.id] ?? "present" : "unmarked";
    return m;
  });

  const setAll = (status: Status) =>
    setMarks(Object.fromEntries(students.map((s) => [s.id, status])));
  // First tap on an unmarked student marks them absent (the exception you're
  // usually recording); after that it toggles present/absent.
  const toggle = (id: string) =>
    setMarks((prev) => ({
      ...prev,
      [id]: prev[id] === "unmarked" ? "absent" : prev[id] === "present" ? "absent" : "present",
    }));

  const presentCount = useMemo(
    () => Object.values(marks).filter((v) => v === "present").length,
    [marks]
  );
  const unmarkedCount = useMemo(
    () => Object.values(marks).filter((v) => v === "unmarked").length,
    [marks]
  );
  const absentCount = students.length - presentCount - unmarkedCount;
  const hasUnmarked = unmarkedCount > 0;

  return (
    <form action={formAction}>
      {!alreadyMarked && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          No attendance saved for this date yet — nothing is carried over from other days.
          Use <span className="font-medium">All present</span> / <span className="font-medium">All absent</span> or
          tap each student, then submit.
        </div>
      )}
      <div className="card overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-4 py-3">
          <div className="text-sm text-stone-600">
            <span className="font-medium text-green-700">{presentCount} present</span> ·{" "}
            <span className="font-medium text-red-600">{absentCount} absent</span> ·{" "}
            {hasUnmarked && (
              <>
                <span className="font-medium text-stone-500">{unmarkedCount} unmarked</span> ·{" "}
              </>
            )}
            {students.length} total
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setAll("present")} className="rounded-lg border border-stone-200 bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-900 hover:bg-stone-200">
              All present
            </button>
            <button type="button" onClick={() => setAll("absent")} className="rounded-lg border border-stone-200 bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-900 hover:bg-stone-200">
              All absent
            </button>
          </div>
        </div>

        <ul className="divide-y divide-stone-100">
          {students.map((s, i) => {
            const mark = marks[s.id] ?? "unmarked";
            return (
              <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <input type="hidden" name={`att_${s.id}`} value={mark} />
                <div className="min-w-0">
                  <span className="mr-2 text-xs text-stone-400">{i + 1}</span>
                  <span className="font-medium text-stone-800">{s.full_name}</span>
                  {s.admission_no && <span className="ml-2 text-xs text-stone-400">{s.admission_no}</span>}
                </div>
                <button
                  type="button"
                  onClick={() => toggle(s.id)}
                  className={
                    "w-24 shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition " +
                    (mark === "present"
                      ? "bg-green-100 text-green-800 hover:bg-green-200"
                      : mark === "absent"
                      ? "bg-red-100 text-red-800 hover:bg-red-200"
                      : "bg-stone-100 text-stone-500 hover:bg-stone-200")
                  }
                >
                  {mark === "present" ? "Present" : mark === "absent" ? "Absent" : "Mark"}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {state?.error && <p className="mt-3 text-sm text-red-600">{state.error}</p>}
      {state?.ok && (
        <p className="mt-3 text-sm text-green-700">
          Saved · {state.present} present, {state.absent} absent.
        </p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || hasUnmarked}
          className="rounded-lg bg-stone-900 px-6 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Submit attendance"}
        </button>
        {hasUnmarked && (
          <span className="text-xs text-stone-500">
            Mark every student before submitting ({unmarkedCount} left).
          </span>
        )}
      </div>
    </form>
  );
}
