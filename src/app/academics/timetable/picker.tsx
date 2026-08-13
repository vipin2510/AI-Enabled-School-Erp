"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  classes: { id: string; display_name: string }[];
  sectionsByClass: Record<string, string[]>;
  initialClassId: string;
  initialSection: string;
};

const field = "rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm";

// Client picker so the Section dropdown fills in the moment a Class is chosen,
// instead of only after navigating. "Open" loads that class/section's grid.
export default function TimetablePicker({
  classes,
  sectionsByClass,
  initialClassId,
  initialSection,
}: Props) {
  const router = useRouter();
  const [classId, setClassId] = useState(initialClassId);
  const [section, setSection] = useState(initialSection);

  const sections = sectionsByClass[classId] ?? [];

  const open = () => {
    if (!classId) return;
    const params = new URLSearchParams({ classId, section });
    router.push(`/academics/timetable?${params.toString()}`);
  };

  return (
    <div className="card mb-5 flex flex-wrap items-end gap-3 p-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-stone-500">Class</span>
        <select
          value={classId}
          onChange={(e) => {
            setClassId(e.target.value);
            setSection("");
          }}
          className={field}
        >
          <option value="">— pick a class —</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.display_name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-stone-500">Section</span>
        <select
          value={section}
          onChange={(e) => setSection(e.target.value)}
          className={field}
          disabled={!classId}
        >
          <option value="">None</option>
          {sections.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={open}
        disabled={!classId}
        className="rounded-lg bg-stone-900 px-4 py-2 text-sm text-stone-50 disabled:opacity-50"
      >
        Open
      </button>
    </div>
  );
}
