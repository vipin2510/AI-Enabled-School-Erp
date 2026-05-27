"use client";

import { useActionState, useMemo, useState } from "react";
import { saveAttendance, type AttendanceState } from "./actions";

type Student = { id: string; full_name: string; admission_no: string | null };
type Status = "present" | "absent";

export default function AttendanceForm({
  classId,
  section,
  date,
  students,
  initial,
}: {
  classId: string;
  section: string;
  date: string;
  students: Student[];
  initial: Record<string, Status>;
}) {
  const action = saveAttendance.bind(null, classId, section, date);
  const [state, formAction, pending] = useActionState<AttendanceState, FormData>(action, undefined);

  // Default everyone present unless an existing record marks them absent.
  const [marks, setMarks] = useState<Record<string, Status>>(() => {
    const m: Record<string, Status> = {};
    for (const s of students) m[s.id] = initial[s.id] ?? "present";
    return m;
  });

  const setAll = (status: Status) =>
    setMarks(Object.fromEntries(students.map((s) => [s.id, status])));
  const toggle = (id: string) =>
    setMarks((prev) => ({ ...prev, [id]: prev[id] === "present" ? "absent" : "present" }));

  const presentCount = useMemo(
    () => Object.values(marks).filter((v) => v === "present").length,
    [marks]
  );

  return (
    <form action={formAction}>
      <div className="card overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-4 py-3">
          <div className="text-sm text-stone-600">
            <span className="font-medium text-green-700">{presentCount} present</span> ·{" "}
            <span className="font-medium text-red-600">{students.length - presentCount} absent</span> ·{" "}
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
            const present = marks[s.id] === "present";
            return (
              <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <input type="hidden" name={`att_${s.id}`} value={marks[s.id]} />
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
                    (present
                      ? "bg-green-100 text-green-800 hover:bg-green-200"
                      : "bg-red-100 text-red-800 hover:bg-red-200")
                  }
                >
                  {present ? "Present" : "Absent"}
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

      <div className="mt-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-stone-900 px-6 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Submit attendance"}
        </button>
      </div>
    </form>
  );
}
