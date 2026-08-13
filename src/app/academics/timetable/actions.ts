"use server";

import { revalidatePath } from "next/cache";
import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { TimetableSlot, TimetableKind } from "@/lib/timetable";

export type SaveTimetableInput = {
  classId: string;
  section: string;
  kind: TimetableKind;
  slots: TimetableSlot[];
  // Only used for the remedial timetable — its validity window.
  startDate?: string | null;
  endDate?: string | null;
};

export type SaveTimetableResult = { saved: true } | { error: string };

// Replace one class+section's grid for a single timetable kind ('regular' or
// 'remedial'). Every period 1..8 is a normal editable slot now. The two kinds
// are independent — saving one never touches the other.
export async function saveTimetable(
  input: SaveTimetableInput
): Promise<SaveTimetableResult> {
  const profile = await requireDepartment("academics");
  const schoolId = await getCurrentSchoolId(profile);

  const classId = input.classId;
  if (!classId) return { error: "Pick a class first." };
  const section = input.section ?? "";
  const kind: TimetableKind = input.kind === "remedial" ? "remedial" : "regular";

  const supabase = await createClient();

  const { error: delErr } = await supabase
    .from("timetable_slots")
    .delete()
    .eq("school_id", schoolId)
    .eq("class_id", classId)
    .eq("section", section)
    .eq("kind", kind);
  if (delErr) return { error: delErr.message };

  const rows = (input.slots ?? [])
    .filter((s) => s.day >= 1 && s.day <= 6 && s.period >= 1 && s.period <= 8)
    // Skip empty cells — a slot only matters if it has a subject or a teacher.
    .filter((s) => (s.subject_name && s.subject_name.trim()) || s.teacher_id)
    .map((s) => ({
      school_id: schoolId,
      class_id: classId,
      section,
      kind,
      day: s.day,
      period: s.period,
      subject_name: s.subject_name?.trim() || null,
      teacher_id: s.teacher_id || null,
      updated_at: new Date().toISOString(),
    }));

  if (rows.length) {
    const { error } = await supabase.from("timetable_slots").insert(rows);
    if (error) return { error: error.message };
  }

  // Persist the remedial validity window (from → till).
  if (kind === "remedial") {
    const { error: metaErr } = await supabase.from("remedial_timetables").upsert(
      {
        school_id: schoolId,
        class_id: classId,
        section,
        start_date: input.startDate || null,
        end_date: input.endDate || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "school_id,class_id,section" }
    );
    if (metaErr) return { error: metaErr.message };
  }

  revalidatePath("/academics/timetable");
  return { saved: true };
}
