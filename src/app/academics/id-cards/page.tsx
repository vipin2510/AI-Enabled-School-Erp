import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import IdCardForm from "./id-card-form";

export const dynamic = "force-dynamic";

type SectionRow = { class_id: string; name: string };

export default async function IdCardsPage() {
  const profile = await requireDepartment("academics");
  const schoolId = await getCurrentSchoolId(profile);
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
  for (const s of (sections ?? []) as SectionRow[]) {
    (sectionsByClass[s.class_id] ??= []).push(s.name);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">ID Cards</h1>
        <p className="mt-1 text-sm text-stone-500">
          Generate a print-ready sheet of student ID cards for a class.
        </p>
      </header>
      <IdCardForm
        classes={(classes ?? []) as { id: string; display_name: string }[]}
        sectionsByClass={sectionsByClass}
      />
    </div>
  );
}
