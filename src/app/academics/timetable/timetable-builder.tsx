"use client";

import { useMemo, useState } from "react";
import {
  generateTimetables,
  type GenerateResult,
  type SubjectInput,
  type SubjectKind,
  type Timetable,
  type TimetableInput,
} from "@/lib/timetable";

const field =
  "rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900";

type SubjectRow = SubjectInput & { id: string };

export type ClassOption = { id: string; display_name: string; ordinal: number };
export type SubjectSeed = { name: string; kind: SubjectKind };

type Props = {
  classes: ClassOption[];
  sectionsByClass: Record<string, string[]>;
  subjectsByClass: Record<string, SubjectSeed[]>;
};

function newRow(seed: Partial<SubjectInput> = {}): SubjectRow {
  return {
    id: crypto.randomUUID(),
    name: seed.name ?? "",
    teacher: seed.teacher ?? "",
    periodsPerWeek: seed.periodsPerWeek ?? 5,
    kind: seed.kind ?? "scholastic",
  };
}

// Seed the subjects table from a class's stored subjects. Empty when the
// class has no subjects yet — the Add subject button stays for ad-hoc rows.
function rowsForClass(seeds: SubjectSeed[] | undefined): SubjectRow[] {
  if (!seeds || seeds.length === 0) return [];
  return seeds.map((s) =>
    newRow({
      name: s.name,
      kind: s.kind,
      periodsPerWeek: s.kind === "co_curricular" ? 2 : 5,
    })
  );
}

export default function TimetableBuilder({ classes, sectionsByClass, subjectsByClass }: Props) {
  const initialClassId = classes[0]?.id ?? "";
  const [classId, setClassId] = useState(initialClassId);
  const [section, setSection] = useState((sectionsByClass[initialClassId] ?? [])[0] ?? "");
  const [daysPerWeek, setDaysPerWeek] = useState<5 | 6>(6);
  const [periodsPerDay, setPeriodsPerDay] = useState(8);
  const [periodMinutes, setPeriodMinutes] = useState(40);
  const [startTime, setStartTime] = useState("08:00");
  const [lunchAfterPeriod, setLunchAfterPeriod] = useState(4);
  const [lunchMinutes, setLunchMinutes] = useState(30);
  const [totalTeachers, setTotalTeachers] = useState(12);
  const [subjects, setSubjects] = useState<SubjectRow[]>(() => rowsForClass(subjectsByClass[initialClassId]));
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  // Derived display name used as the timetable header and PDF filename.
  // Falls back to display_name alone when no section is picked.
  const klass = classes.find((c) => c.id === classId);
  const className = klass
    ? section
      ? `${klass.display_name} — ${section}`
      : klass.display_name
    : "";

  function pickClass(newClassId: string) {
    setClassId(newClassId);
    const sects = sectionsByClass[newClassId] ?? [];
    setSection(sects[0] ?? "");
    setSubjects(rowsForClass(subjectsByClass[newClassId]));
    setResult(null);
  }

  const input: TimetableInput = useMemo(
    () => ({
      className,
      daysPerWeek,
      periodsPerDay,
      periodMinutes,
      startTime,
      lunchAfterPeriod,
      lunchMinutes,
      totalTeachers,
      subjects: subjects.map((r) => ({
        name: r.name,
        teacher: r.teacher,
        periodsPerWeek: r.periodsPerWeek,
        kind: r.kind,
      })),
    }),
    [
      className,
      daysPerWeek,
      periodsPerDay,
      periodMinutes,
      startTime,
      lunchAfterPeriod,
      lunchMinutes,
      totalTeachers,
      subjects,
    ]
  );

  const totalTickets = subjects.reduce((s, x) => s + (x.periodsPerWeek || 0), 0);
  const capacity = daysPerWeek * periodsPerDay;

  function updateSubject(id: string, patch: Partial<SubjectInput>) {
    setSubjects((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function removeSubject(id: string) {
    setSubjects((prev) => prev.filter((r) => r.id !== id));
  }
  function addSubject() {
    setSubjects((prev) => [...prev, newRow()]);
  }

  function generate() {
    setResult(generateTimetables(input));
  }

  async function downloadPdf(variant: Timetable) {
    setDownloading(variant.label);
    try {
      const res = await fetch("/api/academics/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ className, timetable: variant }),
      });
      if (!res.ok) {
        alert("Could not generate PDF. Try again.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safe = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
      a.download = `timetable-${safe(className)}-${safe(variant.label)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="card p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
          1 · Class & schedule
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Labeled label="Class">
            <select
              className={field}
              value={classId}
              onChange={(e) => pickClass(e.target.value)}
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.display_name}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label="Section">
            {(sectionsByClass[classId] ?? []).length ? (
              <select
                className={field}
                value={section}
                onChange={(e) => setSection(e.target.value)}
              >
                <option value="">— None —</option>
                {(sectionsByClass[classId] ?? []).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className={field}
                value={section}
                onChange={(e) => setSection(e.target.value)}
                placeholder="No sections defined"
              />
            )}
          </Labeled>
          <Labeled label="Days per week">
            <select
              className={field}
              value={daysPerWeek}
              onChange={(e) => setDaysPerWeek(Number(e.target.value) as 5 | 6)}
            >
              <option value={5}>5 (Mon–Fri)</option>
              <option value={6}>6 (Mon–Sat)</option>
            </select>
          </Labeled>
          <Labeled label="Periods per day">
            <input
              type="number"
              min={1}
              max={12}
              className={field}
              value={periodsPerDay}
              onChange={(e) => setPeriodsPerDay(Math.max(1, Number(e.target.value)))}
            />
          </Labeled>
          <Labeled label="Period length (min)">
            <input
              type="number"
              min={20}
              max={90}
              className={field}
              value={periodMinutes}
              onChange={(e) => setPeriodMinutes(Math.max(20, Number(e.target.value)))}
            />
          </Labeled>
          <Labeled label="School start time">
            <input
              type="time"
              className={field}
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </Labeled>
          <Labeled label="Lunch after period">
            <select
              className={field}
              value={lunchAfterPeriod}
              onChange={(e) => setLunchAfterPeriod(Number(e.target.value))}
            >
              <option value={0}>No lunch break</option>
              {Array.from({ length: periodsPerDay }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  After period {n}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label="Lunch length (min)">
            <input
              type="number"
              min={0}
              max={90}
              className={field}
              value={lunchMinutes}
              onChange={(e) => setLunchMinutes(Math.max(0, Number(e.target.value)))}
            />
          </Labeled>
          <Labeled label="Total teachers available">
            <input
              type="number"
              min={0}
              className={field}
              value={totalTeachers}
              onChange={(e) => setTotalTeachers(Math.max(0, Number(e.target.value)))}
            />
          </Labeled>
        </div>
      </section>

      <section className="card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            2 · Subjects
          </h2>
          <div className="text-xs text-stone-500">
            {totalTickets} of {capacity} weekly periods used
            {totalTickets > capacity ? (
              <span className="ml-2 rounded bg-rose-100 px-1.5 py-0.5 text-rose-800">
                over capacity
              </span>
            ) : null}
          </div>
        </div>
        <div className="space-y-2">
          {subjects.map((row) => (
            <div
              key={row.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-stone-200 bg-stone-50/60 p-2"
            >
              <input
                className={field + " flex-1 min-w-40"}
                placeholder="Subject"
                value={row.name}
                onChange={(e) => updateSubject(row.id, { name: e.target.value })}
              />
              <input
                className={field + " flex-1 min-w-40"}
                placeholder="Teacher"
                value={row.teacher}
                onChange={(e) => updateSubject(row.id, { teacher: e.target.value })}
              />
              <label className="flex items-center gap-1 text-xs text-stone-600">
                Periods/wk
                <input
                  type="number"
                  min={0}
                  max={20}
                  className={field + " w-16"}
                  value={row.periodsPerWeek}
                  onChange={(e) =>
                    updateSubject(row.id, {
                      periodsPerWeek: Math.max(0, Number(e.target.value)),
                    })
                  }
                />
              </label>
              <select
                className={field + " w-36"}
                value={row.kind}
                onChange={(e) =>
                  updateSubject(row.id, { kind: e.target.value as SubjectKind })
                }
              >
                <option value="scholastic">Scholastic</option>
                <option value="co_curricular">Co-curricular</option>
              </select>
              <button
                type="button"
                onClick={() => removeSubject(row.id)}
                className="rounded px-2 py-1 text-xs text-stone-500 hover:bg-stone-200"
                aria-label={`Remove ${row.name || "subject"}`}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addSubject}
          className="mt-3 rounded-lg border border-dashed border-stone-300 px-3 py-1.5 text-xs text-stone-600 hover:border-stone-500 hover:text-stone-900"
        >
          + Add subject
        </button>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={generate}
          disabled={subjects.length === 0}
          className="rounded-lg bg-stone-900 px-5 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:bg-stone-300"
        >
          Generate 3 timetables
        </button>
        {result ? (
          <button
            type="button"
            onClick={() => setResult(null)}
            className="text-sm text-stone-500 hover:text-stone-900"
          >
            Clear
          </button>
        ) : null}
      </div>

      {result?.warnings.length ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <div className="mb-1 font-semibold">Heads up</div>
          <ul className="list-disc pl-5">
            {result.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {result?.variants.map((v) => (
        <VariantCard
          key={v.label}
          variant={v}
          downloading={downloading === v.label}
          onDownload={() => downloadPdf(v)}
        />
      ))}
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-stone-600">{label}</span>
      {children}
    </label>
  );
}

function VariantCard({
  variant,
  downloading,
  onDownload,
}: {
  variant: Timetable;
  downloading: boolean;
  onDownload: () => void;
}) {
  const { slots, lunchSlot, days, grid } = variant;
  return (
    <section className="card overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-stone-50 px-4 py-3">
        <div>
          <h3 className="font-semibold">{variant.label}</h3>
          <p className="text-xs text-stone-500">
            {days.length} days · {slots.length} periods · first bell {slots[0]?.startTime}
          </p>
        </div>
        <button
          type="button"
          onClick={onDownload}
          disabled={downloading}
          className="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {downloading ? "Preparing PDF…" : "Download PDF"}
        </button>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-xs">
          <thead>
            <tr className="bg-stone-900 text-white">
              <th className="px-2 py-2 text-left font-semibold">Day</th>
              {slots.map((s) => (
                <th key={s.index} className="px-2 py-2 text-center font-semibold">
                  P{s.index}
                  <div className="text-[10px] font-normal opacity-80">
                    {s.startTime}–{s.endTime}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((d, di) => (
              <tr key={d} className={di % 2 ? "bg-stone-50" : ""}>
                <td className="border-t border-stone-200 px-2 py-2 font-semibold">{d}</td>
                {slots.map((s) => {
                  const cell = grid[di][s.index - 1];
                  return (
                    <td
                      key={s.index}
                      className="border-t border-stone-200 px-2 py-2 text-center align-top"
                    >
                      {"free" in cell ? (
                        <span className="italic text-stone-400">Free</span>
                      ) : (
                        <>
                          <div className="font-medium">{cell.subject}</div>
                          {cell.teacher ? (
                            <div className="text-[10px] text-stone-500">{cell.teacher}</div>
                          ) : null}
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {lunchSlot ? (
              <tr>
                <td
                  colSpan={slots.length + 1}
                  className="border-t border-stone-200 bg-amber-50 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-amber-900"
                >
                  Lunch break · {lunchSlot.startTime}–{lunchSlot.endTime}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
