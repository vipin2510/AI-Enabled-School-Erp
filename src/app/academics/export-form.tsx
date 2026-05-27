"use client";

import { useState } from "react";

type Props = {
  classes: { id: string; display_name: string }[];
  sectionsByClass: Record<string, string[]>;
};

const field =
  "rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function AttendanceExportForm({ classes, sectionsByClass }: Props) {
  const now = new Date();
  const [classId, setClassId] = useState("");
  const [section, setSection] = useState("");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const sections = classId ? sectionsByClass[classId] ?? [] : [];
  const years = [now.getFullYear(), now.getFullYear() - 1];

  // Plain GET to the CSV route — the browser downloads the attachment.
  const href = `/api/academics/attendance-export?class_id=${classId}&section=${encodeURIComponent(
    section
  )}&month=${month}&year=${year}`;

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">Class</label>
        <select
          className={field}
          value={classId}
          onChange={(e) => {
            setClassId(e.target.value);
            setSection("");
          }}
        >
          <option value="">— Select —</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.display_name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">Section</label>
        <select
          className={field}
          value={section}
          onChange={(e) => setSection(e.target.value)}
          disabled={!sections.length}
        >
          <option value="">{sections.length ? "— Select —" : "No sections"}</option>
          {sections.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">Month</label>
        <select className={field} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">Year</label>
        <select className={field} value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
      <a
        href={classId && section ? href : undefined}
        aria-disabled={!classId || !section}
        className={
          "rounded-lg px-5 py-2 text-sm font-medium text-white " +
          (classId && section
            ? "bg-stone-900 hover:bg-stone-800"
            : "pointer-events-none bg-stone-300")
        }
      >
        Download CSV
      </a>
    </div>
  );
}
