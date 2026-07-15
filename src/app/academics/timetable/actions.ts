"use server";

import { revalidatePath } from "next/cache";
import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { TimetableSlot } from "@/lib/timetable";

export type SaveTimetableInput = {
  classId: string;
  section: string;
  slots: TimetableSlot[];
};

export type SaveTimetableResult = { saved: true } | { error: string };

// Replace the whole timetable grid for one class+section. Period 1 (class
// teacher) is never stored here — only periods 2..8.
export async function saveTimetable(
  input: SaveTimetableInput
): Promise<SaveTimetableResult> {
  const profile = await requireDepartment("academics");
  const schoolId = await getCurrentSchoolId(profile);

  const classId = input.classId;
  if (!classId) return { error: "Pick a class first." };
  const section = input.section ?? "";

  const supabase = await createClient();

  const { error: delErr } = await supabase
    .from("timetable_slots")
    .delete()
    .eq("school_id", schoolId)
    .eq("class_id", classId)
    .eq("section", section);
  if (delErr) return { error: delErr.message };

  const rows = (input.slots ?? [])
    .filter((s) => s.day >= 1 && s.day <= 6 && s.period >= 2 && s.period <= 8)
    // Skip empty cells — a slot only matters if it has a subject or a teacher.
    .filter((s) => (s.subject_name && s.subject_name.trim()) || s.teacher_id)
    .map((s) => ({
      school_id: schoolId,
      class_id: classId,
      section,
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

  revalidatePath("/academics/timetable");
  return { saved: true };
}
