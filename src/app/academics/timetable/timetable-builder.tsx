"use client";

import { useMemo, useState, useTransition } from "react";
import {
  periodsForDay,
  MAX_PERIOD,
  type TimetableSlot,
  type TimetableKind,
} from "@/lib/timetable";
import { saveTimetable } from "./actions";

export type Teacher = { id: string; name: string };
export type TimetableSlotSeed = {
  day: number;
  period: number;
  subject_name: string | null;
  teacher_id: string | null;
};

type Cell = { subject_name: string; teacher_id: string };
const keyOf = (day: number, period: number) => `${day}-${period}`;

const seedCells = (slots: TimetableSlotSeed[]): Record<string, Cell> => {
  const init: Record<string, Cell> = {};
  for (const s of slots) {
    init[keyOf(s.day, s.period)] = {
      subject_name: s.subject_name ?? "",
      teacher_id: s.teacher_id ?? "",
    };
  }
  return init;
};

export default function TimetableBuilder({
  classId,
  section,
  className,
  subjects,
  teachers,
  regularSlots,
  remedialSlots,
  remedialStart,
  remedialEnd,
  days,
}: {
  classId: string;
  section: string;
  className: string;
  subjects: string[];
  teachers: Teacher[];
  regularSlots: TimetableSlotSeed[];
  remedialSlots: TimetableSlotSeed[];
  remedialStart: string | null;
  remedialEnd: string | null;
  days: { n: number; name: string; full: string }[];
}) {
  const [mode, setMode] = useState<TimetableKind>("regular");
  // One editable grid per kind, kept side by side so switching tabs is instant.
  const [cellsByKind, setCellsByKind] = useState<Record<TimetableKind, Record<string, Cell>>>(() => ({
    regular: seedCells(regularSlots),
    remedial: seedCells(remedialSlots),
  }));
  const [remStart, setRemStart] = useState(remedialStart ?? "");
  const [remEnd, setRemEnd] = useState(remedialEnd ?? "");
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const periods = useMemo(() => Array.from({ length: MAX_PERIOD }, (_, i) => i + 1), []);
  const cells = cellsByKind[mode];

  const update = (day: number, period: number, patch: Partial<Cell>) => {
    setDirty(true);
    setStatus(null);
    setCellsByKind((prev) => {
      const grid = prev[mode];
      const k = keyOf(day, period);
      const cur = grid[k] ?? { subject_name: "", teacher_id: "" };
      return { ...prev, [mode]: { ...grid, [k]: { ...cur, ...patch } } };
    });
  };

  const save = () => {
    if (mode === "remedial" && remStart && remEnd && remEnd < remStart) {
      setStatus("End date can’t be before the start date.");
      return;
    }
    const slots: TimetableSlot[] = [];
    for (const d of days) {
      for (let p = 1; p <= periodsForDay(d.n); p++) {
        const c = cells[keyOf(d.n, p)];
        if (!c) continue;
        slots.push({
          day: d.n,
          period: p,
          subject_name: c.subject_name || null,
          teacher_id: c.teacher_id || null,
        });
      }
    }
    startTransition(async () => {
      const res = await saveTimetable({
        classId,
        section,
        kind: mode,
        slots,
        startDate: mode === "remedial" ? remStart || null : null,
        endDate: mode === "remedial" ? remEnd || null : null,
      });
      if ("error" in res) setStatus(`Error: ${res.error}`);
      else {
        setStatus("Saved.");
        setDirty(false);
      }
    });
  };

  const pdfUrl = `/api/academics/timetable?classId=${encodeURIComponent(classId)}&section=${encodeURIComponent(section)}&kind=${mode}`;
  const datalistId = "tt-subjects";

  const tab = (k: TimetableKind, label: string) => (
    <button
      key={k}
      type="button"
      onClick={() => {
        setMode(k);
        setStatus(null);
      }}
      className={
        "rounded-lg px-3 py-1.5 text-sm font-medium " +
        (mode === k ? "bg-stone-900 text-stone-50" : "border border-stone-200 bg-white text-stone-700 hover:bg-stone-50")
      }
    >
      {label}
    </button>
  );

  return (
    <div className="card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="font-medium">{className}</div>
          <div className="flex gap-1.5">
            {tab("regular", "Regular")}
            {tab("remedial", "Remedial")}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {status && <span className="text-sm text-stone-500">{status}</span>}
          <button
            onClick={save}
            disabled={pending}
            className="rounded-lg bg-stone-900 px-4 py-2 text-sm text-stone-50 disabled:opacity-50"
          >
            {pending ? "Saving…" : `Save ${mode === "remedial" ? "remedial" : "timetable"}`}
          </button>
          <a
            href={pdfUrl}
            className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
            title={dirty ? "Save first to include your latest edits" : undefined}
          >
            ⤓ Class PDF
          </a>
        </div>
      </div>

      {mode === "remedial" && (
        <div className="mb-3 flex flex-wrap items-end gap-4 rounded-lg bg-sky-50 px-3 py-3">
          <div className="text-xs text-sky-800">
            Remedial (non-curricular) timetable. Set the dates it applies between.
          </div>
          <label className="flex flex-col gap-1 text-xs text-stone-600">
            Applicable from
            <input
              type="date"
              value={remStart}
              onChange={(e) => {
                setRemStart(e.target.value);
                setDirty(true);
              }}
              className="rounded border border-stone-200 px-2 py-1 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-stone-600">
            till
            <input
              type="date"
              value={remEnd}
              min={remStart || undefined}
              onChange={(e) => {
                setRemEnd(e.target.value);
                setDirty(true);
              }}
              className="rounded border border-stone-200 px-2 py-1 text-sm"
            />
          </label>
        </div>
      )}

      {dirty && (
        <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Unsaved changes — click “Save” before downloading the PDF.
        </div>
      )}

      <datalist id={datalistId}>
        {subjects.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-stone-200 bg-stone-50 px-2 py-1.5 text-left font-medium">Day</th>
              {periods.map((p) => (
                <th key={p} className="border border-stone-200 bg-stone-50 px-2 py-1.5 font-medium">
                  P{p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.n}>
                <td className="border border-stone-200 bg-stone-50 px-2 py-1.5 font-medium whitespace-nowrap">
                  {d.full}
                </td>
                {periods.map((p) => {
                  // Beyond this day's period count (Saturday P6–P8).
                  if (p > periodsForDay(d.n)) {
                    return (
                      <td key={p} className="border border-stone-200 bg-stone-100 px-2 py-1.5 text-center text-stone-300">
                        —
                      </td>
                    );
                  }
                  const c = cells[keyOf(d.n, p)] ?? { subject_name: "", teacher_id: "" };
                  return (
                    <td key={p} className="border border-stone-200 px-1.5 py-1.5 align-top">
                      <input
                        list={datalistId}
                        value={c.subject_name}
                        onChange={(e) => update(d.n, p, { subject_name: e.target.value })}
                        placeholder="Subject"
                        className="mb-1 w-full rounded border border-stone-200 px-1.5 py-1 text-xs"
                      />
                      <select
                        value={c.teacher_id}
                        onChange={(e) => update(d.n, p, { teacher_id: e.target.value })}
                        className="w-full rounded border border-stone-200 px-1 py-1 text-xs"
                        aria-label={`Teacher ${d.name} P${p}`}
                      >
                        <option value="">— teacher —</option>
                        {teachers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
