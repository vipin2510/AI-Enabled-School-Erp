"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole, getCurrentSchoolId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { currentAcademicYear } from "@/lib/academic-year";

export type TcState = { error?: string } | undefined;

const blank = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
};

const IssueSchema = z.object({
  student_id: z.string().uuid(),
  caste: z.string().nullable(),
  admission_date: z.string().nullable(),
  date_of_leaving: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the date of leaving."),
  school_days_attended: z.string().nullable(),
  studying_class: z.string().nullable(),
  last_exam_class: z.string().nullable(),
  last_exam_year: z.string().nullable(),
  last_exam_result: z.string().nullable(),
  promoted_to_class: z.string().nullable(),
  admitted_in: z.string().nullable(),
  conduct: z.string().nullable(),
  reason: z.string().nullable(),
  remarks: z.string().nullable(),
  no_dues_amount: z.number().nonnegative().default(0),
});

// Issue a Transfer Certificate (admin only): snapshots the student, writes the
// TC (the DB trigger assigns the number), and FREEZES the student so no new
// fees can be collected — history stays intact.
export async function issueTc(_prev: TcState, fd: FormData): Promise<TcState> {
  const profile = await requireRole("admin");
  const schoolId = await getCurrentSchoolId(profile);

  const noDuesRaw = String(fd.get("no_dues_amount") ?? "0").trim();
  const parsed = IssueSchema.safeParse({
    student_id: String(fd.get("student_id") ?? ""),
    caste: blank(fd, "caste"),
    admission_date: blank(fd, "admission_date"),
    date_of_leaving: String(fd.get("date_of_leaving") ?? "").trim(),
    school_days_attended: blank(fd, "school_days_attended"),
    studying_class: blank(fd, "studying_class"),
    last_exam_class: blank(fd, "last_exam_class"),
    last_exam_year: blank(fd, "last_exam_year"),
    last_exam_result: blank(fd, "last_exam_result"),
    promoted_to_class: blank(fd, "promoted_to_class"),
    admitted_in: blank(fd, "admitted_in"),
    conduct: blank(fd, "conduct") ?? "Good",
    reason: blank(fd, "reason"),
    remarks: blank(fd, "remarks"),
    no_dues_amount: Number(noDuesRaw) || 0,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const supabase = await createClient();

  // Snapshot student identity.
  const { data: student, error: sErr } = await supabase
    .from("students")
    .select("id, admission_no, full_name, father_name, mother_name, date_of_birth, status")
    .eq("school_id", schoolId)
    .eq("id", parsed.data.student_id)
    .maybeSingle();
  if (sErr) return { error: sErr.message };
  if (!student) return { error: "Student not found in this school." };

  const d = parsed.data;
  const { data: tc, error: tcErr } = await supabase
    .from("transfer_certificates")
    .insert({
      school_id: schoolId,
      student_id: student.id,
      academic_year: currentAcademicYear(),
      status: "issued",
      admission_no: student.admission_no,
      student_name: student.full_name,
      father_name: student.father_name,
      mother_name: student.mother_name,
      date_of_birth: student.date_of_birth,
      caste: d.caste,
      admission_date: d.admission_date,
      date_of_leaving: d.date_of_leaving,
      school_days_attended: d.school_days_attended,
      studying_class: d.studying_class,
      last_exam_class: d.last_exam_class,
      last_exam_year: d.last_exam_year,
      last_exam_result: d.last_exam_result,
      promoted_to_class: d.promoted_to_class,
      admitted_in: d.admitted_in,
      conduct: d.conduct,
      reason: d.reason,
      remarks: d.remarks,
      no_dues_amount: d.no_dues_amount,
      issued_by: profile.full_name || null,
      requested_by: profile.id,
    })
    .select("id")
    .single();
  if (tcErr || !tc) return { error: tcErr?.message ?? "Could not create TC." };

  // Freeze the student — excluded from the collect picker and blocked from new
  // collection (see the collect page + /api/invoices guard).
  const { error: fErr } = await supabase
    .from("students")
    .update({ status: "inactive", updated_at: new Date().toISOString() })
    .eq("school_id", schoolId)
    .eq("id", student.id);
  if (fErr) return { error: `TC created but freeze failed: ${fErr.message}` };

  revalidatePath("/academics/tc");
  revalidatePath(`/academics/students/${student.id}`);
  redirect(`/academics/tc?issued=${tc.id}`);
}

// Admin-only: reverse a freeze (e.g. TC issued by mistake). Reactivates the
// student; the TC row is kept for the record but marked cancelled.
export async function cancelTc(fd: FormData) {
  const profile = await requireRole("admin");
  const schoolId = await getCurrentSchoolId(profile);
  const tcId = String(fd.get("tc_id") ?? "");
  const studentId = String(fd.get("student_id") ?? "");
  if (!tcId) return;
  const supabase = await createClient();
  await supabase.from("transfer_certificates").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("school_id", schoolId).eq("id", tcId);
  if (studentId) {
    await supabase.from("students").update({ status: "active", updated_at: new Date().toISOString() }).eq("school_id", schoolId).eq("id", studentId);
  }
  revalidatePath("/academics/tc");
}
