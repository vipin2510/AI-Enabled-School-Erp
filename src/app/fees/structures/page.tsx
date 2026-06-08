import { createClient } from "@/lib/supabase/server";
import { requireRole, getCurrentSchoolId } from "@/lib/auth";
import { currentAcademicYear } from "@/lib/academic-year";
import StructuresEditor, { type Structure } from "./structures-editor";

export const dynamic = "force-dynamic";

export default async function FeeStructuresPage() {
  // Fee structures hold rate cards — only admin/manager may edit. Staff (Layer
  // 3) are bounced home if they navigate here directly.
  const profile = await requireRole("admin", "manager");
  const schoolId = await getCurrentSchoolId(profile);
  const supabase = await createClient();
  const AY = currentAcademicYear();
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
        <p className="text-stone-500 text-sm">Academic Year {AY}</p>
      </header>

      <StructuresEditor structures={structures} />
    </div>
  );
}
