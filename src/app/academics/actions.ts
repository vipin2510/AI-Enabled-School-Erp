"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function addSection(formData: FormData) {
  await requireRole("admin", "manager");
  const class_id = String(formData.get("class_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!class_id || !name) return;

  const supabase = await createClient();
  await supabase.from("sections").insert({ class_id, name });
  revalidatePath("/academics/classes");
}

export async function removeSection(formData: FormData) {
  await requireRole("admin", "manager");
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("sections").delete().eq("id", id);
  revalidatePath("/academics/classes");
}

export async function addSubject(formData: FormData) {
  await requireRole("admin", "manager");
  const class_id = String(formData.get("class_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!class_id || !name) return;

  const supabase = await createClient();
  await supabase.from("subjects").insert({ class_id, name });
  revalidatePath("/academics/subjects");
}

export async function removeSubject(formData: FormData) {
  await requireRole("admin", "manager");
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("subjects").delete().eq("id", id);
  revalidatePath("/academics/subjects");
}
