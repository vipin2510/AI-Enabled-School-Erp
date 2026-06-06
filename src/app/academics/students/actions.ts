"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { uploadStudentPhoto } from "@/lib/storage";

// Pull the optional photo files out of the form (added by the student form).
function photoFiles(formData: FormData) {
  const student = formData.get("student_photo");
  const parent = formData.get("parent_photo");
  return {
    student: student instanceof File && student.size > 0 ? student : null,
    parent: parent instanceof File && parent.size > 0 ? parent : null,
  };
}

const StudentSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required."),
  admission_no: z.string().trim().nullable(),
  class_id: z.string().uuid().nullable(),
  section: z.string().trim().nullable(),
  gender: z.string().trim().nullable(),
  father_name: z.string().trim().nullable(),
  mother_name: z.string().trim().nullable(),
  contact_number: z.string().trim().nullable(),
  address: z.string().trim().nullable(),
  is_hosteller: z.boolean(),
  is_new_admission: z.boolean(),
  status: z.enum(["active", "inactive", "alumni"]),
  // Per-month bus fee; null means student does not use the bus.
  bus_fee_amount: z.number().int().nonnegative().nullable(),
});

export type StudentState = { error?: string } | undefined;

function parse(formData: FormData) {
  const blank = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v === "" ? null : v;
  };
  const busRaw = blank("bus_fee_amount");
  const busNum = busRaw == null ? null : Number(busRaw);
  return StudentSchema.safeParse({
    full_name: String(formData.get("full_name") ?? "").trim(),
    admission_no: blank("admission_no"),
    class_id: blank("class_id"),
    section: blank("section"),
    gender: blank("gender"),
    father_name: blank("father_name"),
    mother_name: blank("mother_name"),
    contact_number: blank("contact_number"),
    address: blank("address"),
    is_hosteller: formData.get("is_hosteller") === "on",
    is_new_admission: formData.get("is_new_admission") === "on",
    status: String(formData.get("status") ?? "active"),
    bus_fee_amount: busNum != null && Number.isFinite(busNum) ? busNum : null,
  });
}

export async function createStudent(_prev: StudentState, formData: FormData): Promise<StudentState> {
  const profile = await requireDepartment("academics");
  const schoolId = await getCurrentSchoolId(profile);
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const supabase = await createClient();
  const { data: inserted, error } = await supabase
    .from("students")
    .insert({ ...parsed.data, school_id: schoolId })
    .select("id")
    .single();
  if (error || !inserted) return { error: error?.message ?? "Could not create student." };

  const files = photoFiles(formData);
  if (files.student || files.parent) {
    const [studentUrl, parentUrl] = await Promise.all([
      uploadStudentPhoto(inserted.id, "student", files.student),
      uploadStudentPhoto(inserted.id, "parent", files.parent),
    ]);
    const patch: Record<string, string> = {};
    if (studentUrl) patch.student_photo_url = studentUrl;
    if (parentUrl) patch.parent_photo_url = parentUrl;
    if (Object.keys(patch).length)
      await supabase.from("students").update(patch).eq("school_id", schoolId).eq("id", inserted.id);
  }

  revalidatePath("/academics/students");
  redirect("/academics/students");
}

export async function updateStudent(
  id: string,
  _prev: StudentState,
  formData: FormData
): Promise<StudentState> {
  const profile = await requireDepartment("academics");
  const schoolId = await getCurrentSchoolId(profile);
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const supabase = await createClient();
  const files = photoFiles(formData);
  const [studentUrl, parentUrl] = await Promise.all([
    uploadStudentPhoto(id, "student", files.student),
    uploadStudentPhoto(id, "parent", files.parent),
  ]);

  const update: Record<string, unknown> = {
    ...parsed.data,
    updated_at: new Date().toISOString(),
  };
  if (studentUrl) update.student_photo_url = studentUrl;
  if (parentUrl) update.parent_photo_url = parentUrl;

  const { error } = await supabase
    .from("students")
    .update(update)
    .eq("school_id", schoolId)
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/academics/students");
  revalidatePath(`/academics/students/${id}`);
  redirect(`/academics/students/${id}`);
}

export async function deleteStudent(formData: FormData) {
  const profile = await requireDepartment("academics");
  const schoolId = await getCurrentSchoolId(profile);
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  // Students with receipts can't be hard-deleted (FK restrict); mark inactive.
  const { error } = await supabase.from("students").delete().eq("school_id", schoolId).eq("id", id);
  if (error) {
    await supabase
      .from("students")
      .update({ status: "inactive" })
      .eq("school_id", schoolId)
      .eq("id", id);
  }
  revalidatePath("/academics/students");
}
