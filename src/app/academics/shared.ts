import { createClient } from "@/lib/supabase/server";

// Classes (sorted) plus their sections, shaped for the student form's
// class → section dependent dropdown. Scoped to a single school — every
// caller must pass the active school id from `getCurrentSchoolId(profile)`.
export async function loadClassesAndSections(schoolId: string) {
  const supabase = await createClient();
  const [{ data: classes }, { data: sections }] = await Promise.all([
    supabase
      .from("classes")
      .select("id, display_name, ordinal")
      .eq("school_id", schoolId)
      .order("ordinal"),
    supabase
      .from("sections")
      .select("class_id, name")
      .eq("school_id", schoolId)
      .order("name"),
  ]);

  const sectionsByClass: Record<string, string[]> = {};
  for (const s of (sections ?? []) as { class_id: string; name: string }[]) {
    (sectionsByClass[s.class_id] ??= []).push(s.name);
  }

  return {
    classes: (classes ?? []) as { id: string; display_name: string; ordinal: number }[],
    sectionsByClass,
  };
}
