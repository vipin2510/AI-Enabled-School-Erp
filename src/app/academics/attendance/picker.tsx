"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  classes: { id: string; display_name: string }[];
  sectionsByClass: Record<string, string[]>;
  initialClassId: string;
  initialSection: string;
  initialDate: string;
};

const field =
  "rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900";

export default function AttendancePicker({
  classes,
  sectionsByClass,
  initialClassId,
  initialSection,
  initialDate,
}: Props) {
  const router = useRouter();
  const [classId, setClassId] = useState(initialClassId);
  const [section, setSection] = useState(initialSection);
  const [date, setDate] = useState(initialDate);

  const sections = sectionsByClass[classId] ?? [];

  const load = () => {
    if (!classId || !section || !date) return;
    const params = new URLSearchParams({ class_id: classId, section, date });
    router.push(`/academics/attendance?${params.toString()}`);
  };

  return (
    <div className="card flex flex-wrap items-end gap-3 p-4">
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
        <select className={field} value={section} onChange={(e) => setSection(e.target.value)} disabled={!sections.length}>
          <option value="">{sections.length ? "— Select —" : "No sections"}</option>
          {sections.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">Date</label>
        <input type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <button
        onClick={load}
        disabled={!classId || !section || !date}
        className="rounded-lg bg-stone-900 px-5 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
      >
        Load
      </button>
    </div>
  );
}
