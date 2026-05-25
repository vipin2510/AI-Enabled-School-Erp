"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

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
});

export type StudentState = { error?: string } | undefined;

function parse(formData: FormData) {
  const blank = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v === "" ? null : v;
  };
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
  });
}

export async function createStudent(_prev: StudentState, formData: FormData): Promise<StudentState> {
  await requireRole("admin", "manager");
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const supabase = await createClient();
  const { error } = await supabase.from("students").insert(parsed.data);
  if (error) return { error: error.message };

  revalidatePath("/academics/students");
  redirect("/academics/students");
}

export async function updateStudent(
  id: string,
  _prev: StudentState,
  formData: FormData
): Promise<StudentState> {
  await requireRole("admin", "manager");
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("students")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/academics/students");
  redirect("/academics/students");
}

export async function deleteStudent(formData: FormData) {
  await requireRole("admin", "manager");
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  // Students with receipts can't be hard-deleted (FK restrict); mark inactive.
  const { error } = await supabase.from("students").delete().eq("id", id);
  if (error) {
    await supabase.from("students").update({ status: "inactive" }).eq("id", id);
  }
  revalidatePath("/academics/students");
}
