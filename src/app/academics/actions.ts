"use server";

import { revalidatePath } from "next/cache";
import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Admin/manager only — adds a new class to the currently active school.
// `code` is unique per school (see migration 0017). `ordinal` controls
// sort order across the academics screens; the form defaults it to
// max(existing) + 1 so adds land at the end.
export async function addClass(formData: FormData) {
  const profile = await requireDepartment("academics");
  if (profile.role === "staff") return;
  const schoolId = await getCurrentSchoolId(profile);
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const display_name = String(formData.get("display_name") ?? "").trim();
  const ordinalRaw = String(formData.get("ordinal") ?? "").trim();
  const ordinal = ordinalRaw === "" ? null : Number.parseInt(ordinalRaw, 10);
  if (!code || !display_name || ordinal == null || !Number.isFinite(ordinal)) return;

  const supabase = await createClient();
  await supabase
    .from("classes")
    .insert({ code, display_name, ordinal, school_id: schoolId });
  revalidatePath("/academics/classes");
  revalidatePath("/academics/subjects");
}

export async function addSection(formData: FormData) {
  const profile = await requireDepartment("academics");
  const schoolId = await getCurrentSchoolId(profile);
  const class_id = String(formData.get("class_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!class_id || !name) return;

  const supabase = await createClient();
  await supabase.from("sections").insert({ class_id, name, school_id: schoolId });
  revalidatePath("/academics/classes");
}

export async function removeSection(formData: FormData) {
  const profile = await requireDepartment("academics");
  const schoolId = await getCurrentSchoolId(profile);
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("sections").delete().eq("school_id", schoolId).eq("id", id);
  revalidatePath("/academics/classes");
}

export async function addSubject(formData: FormData) {
  const profile = await requireDepartment("academics");
  const schoolId = await getCurrentSchoolId(profile);
  const class_id = String(formData.get("class_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const categoryRaw = String(formData.get("category") ?? "scholastic");
  const category = categoryRaw === "co_curricular" ? "co_curricular" : "scholastic";
  if (!class_id || !name) return;

  const supabase = await createClient();
  await supabase.from("subjects").insert({ class_id, name, category, school_id: schoolId });
  revalidatePath("/academics/subjects");
}

export async function removeSubject(formData: FormData) {
  const profile = await requireDepartment("academics");
  const schoolId = await getCurrentSchoolId(profile);
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("subjects").delete().eq("school_id", schoolId).eq("id", id);
  revalidatePath("/academics/subjects");
}
