"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LayoutZ, type Layout } from "@/lib/result-template";

type TemplateRow = {
  id: string;
  name: string;
  description: string | null;
  page_size: "a4-portrait" | "a4-landscape";
  is_default: boolean;
  layout: Layout;
  created_at: string;
  updated_at: string;
};

// Anyone Layer 1/2 (admin or manager) can manage templates per the design
// note in the plan. Staff is bounced.
async function guard() {
  return requireRole("admin", "manager");
}

export async function listTemplates(): Promise<TemplateRow[]> {
  await guard();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("result_templates")
    .select("id, name, description, page_size, is_default, layout, created_at, updated_at")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as TemplateRow[];
}

export async function getTemplate(id: string): Promise<TemplateRow | null> {
  await guard();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("result_templates")
    .select("id, name, description, page_size, is_default, layout, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as TemplateRow | null;
}

export async function createTemplate(formData: FormData) {
  await guard();
  const name = String(formData.get("name") ?? "").trim();
  const pageSizeRaw = String(formData.get("page_size") ?? "a4-portrait");
  const page_size = pageSizeRaw === "a4-landscape" ? "a4-landscape" : "a4-portrait";
  if (!name) return;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("result_templates")
    .insert({ name, page_size, layout: [] })
    .select("id")
    .single();
  if (error || !data) return;
  revalidatePath("/results/templates");
  redirect(`/results/templates/${data.id}/edit`);
}

export async function cloneTemplate(formData: FormData) {
  await guard();
  const sourceId = String(formData.get("source_id") ?? "");
  if (!sourceId) return;
  const supabase = await createClient();
  const { data: src } = await supabase
    .from("result_templates")
    .select("name, description, page_size, layout")
    .eq("id", sourceId)
    .maybeSingle();
  if (!src) return;
  const { data: created } = await supabase
    .from("result_templates")
    .insert({
      name: `${src.name} (copy)`,
      description: src.description,
      page_size: src.page_size,
      layout: src.layout,
    })
    .select("id")
    .single();
  if (!created) return;
  revalidatePath("/results/templates");
  redirect(`/results/templates/${created.id}/edit`);
}

export async function deleteTemplate(formData: FormData) {
  await guard();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  // Block deleting the active default — there must always be one.
  const { data: row } = await supabase
    .from("result_templates")
    .select("is_default")
    .eq("id", id)
    .maybeSingle();
  if (row?.is_default) return;
  const { count } = await supabase
    .from("result_templates")
    .select("id", { count: "exact", head: true });
  if ((count ?? 0) <= 1) return; // never delete the last template
  await supabase.from("result_templates").delete().eq("id", id);
  revalidatePath("/results/templates");
}

export async function setDefaultTemplate(formData: FormData) {
  await guard();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  // Two-step to keep the partial-unique index happy: clear current
  // default first, then set the new one. Race-safe because the unique
  // index serialises overlapping writes.
  await supabase
    .from("result_templates")
    .update({ is_default: false })
    .eq("is_default", true)
    .neq("id", id);
  await supabase.from("result_templates").update({ is_default: true }).eq("id", id);
  revalidatePath("/results/templates");
  revalidatePath("/results");
}

export type SaveLayoutResult = { ok: true } | { ok: false; error: string };

export async function saveLayout(
  id: string,
  rawLayout: unknown,
  meta: { name?: string; description?: string | null; page_size?: "a4-portrait" | "a4-landscape" }
): Promise<SaveLayoutResult> {
  await guard();
  const parsed = LayoutZ.safeParse(rawLayout);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid layout." };
  }
  const supabase = await createClient();
  const patch: Record<string, unknown> = { layout: parsed.data };
  if (meta.name !== undefined) patch.name = meta.name.trim();
  if (meta.description !== undefined) patch.description = meta.description;
  if (meta.page_size !== undefined) patch.page_size = meta.page_size;
  const { error } = await supabase
    .from("result_templates")
    .update(patch)
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/results/templates");
  revalidatePath(`/results/templates/${id}/edit`);
  return { ok: true };
}
