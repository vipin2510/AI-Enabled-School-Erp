import { createClient } from "@/lib/supabase/server";
import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import StructuresEditor, { type Structure } from "./structures-editor";

export const dynamic = "force-dynamic";

export default async function FeeStructuresPage() {
  const profile = await requireDepartment("fees");
  const schoolId = await getCurrentSchoolId(profile);
  const supabase = await createClient();
  const { data } = await supabase
    .from("fee_structures")
    .select(
      "id, academic_year, scope, group_label, student_kind, total_amount, classes(display_name, ordinal), fee_structure_components(id, label, kind, amount, period_index)"
    )
    .eq("school_id", schoolId)
    .order("scope", { ascending: true });

  const structures = (data ?? []) as unknown as Structure[];

  return (
    <div className="max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Fee Structures</h1>
        <p className="text-stone-500 text-sm">Academic Year 2026-27</p>
      </header>

      <StructuresEditor structures={structures} />
    </div>
  );
}
