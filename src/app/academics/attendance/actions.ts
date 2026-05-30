"use server";

import { revalidatePath } from "next/cache";
import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isSunday } from "@/lib/attendance";

export type AttendanceState =
  | { error?: string; ok?: boolean; present?: number; absent?: number }
  | undefined;

// Save (upsert) one day's attendance for a class-section. Every student gets a
// row via a hidden "att_<id>" field, so the marks are explicit, not inferred
// from unchecked boxes. One row per student per date (unique constraint).
export async function saveAttendance(
  classId: string,
  section: string,
  date: string,
  _prev: AttendanceState,
  formData: FormData
): Promise<AttendanceState> {
  const profile = await requireDepartment("academics");
  const schoolId = await getCurrentSchoolId(profile);
  if (!classId || !section || !date) return { error: "Pick a class, section and date." };
  if (isSunday(date)) return { error: "Attendance can’t be taken on a Sunday." };

  const now = new Date().toISOString();
  const rows: {
    student_id: string;
    class_id: string;
    section: string;
    date: string;
    status: string;
    updated_at: string;
    school_id: string;
  }[] = [];

  for (const [name, value] of formData.entries()) {
    if (!name.startsWith("att_")) continue;
    rows.push({
      student_id: name.slice(4),
      class_id: classId,
      section,
      date,
      status: String(value) === "absent" ? "absent" : "present",
      updated_at: now,
      school_id: schoolId,
    });
  }

  if (rows.length === 0) return { error: "No students to mark." };

  const supabase = await createClient();
  const { error } = await supabase.from("attendance").upsert(rows, { onConflict: "student_id,date" });
  if (error) return { error: error.message };

  revalidatePath("/academics/attendance");
  const present = rows.filter((r) => r.status === "present").length;
  return { ok: true, present, absent: rows.length - present };
}
