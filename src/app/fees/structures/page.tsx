import { createClient } from "@/lib/supabase/server";
import { requireRole, getCurrentSchoolId } from "@/lib/auth";
import { currentAcademicYear } from "@/lib/academic-year";
import StructuresEditor, { type Structure } from "./structures-editor";
import { addHostelStructure } from "./actions";

export const dynamic = "force-dynamic";

export default async function FeeStructuresPage() {
  // Fee structures hold rate cards — only admin/manager may edit. Staff (Layer
  // 3) are bounced home if they navigate here directly.
  const profile = await requireRole("admin", "manager");
  const schoolId = await getCurrentSchoolId(profile);
  const supabase = await createClient();
  const AY = currentAcademicYear();
  const { data, error } = await supabase
    .from("fee_structures")
    .select(
      "id, academic_year, scope, group_label, student_kind, total_amount, classes(display_name, ordinal), fee_structure_components(id, label, kind, amount, period_index)"
    )
    .eq("school_id", schoolId)
    .order("scope", { ascending: true });
  if (error) throw error;

  const structures = (data ?? []) as unknown as Structure[];

  return (
    <div className="max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Fee Structures</h1>
        <p className="text-stone-500 text-sm">Academic Year {AY}</p>
      </header>

      <div className="card p-4">
        <div className="mb-2 text-sm font-medium text-stone-700">Add a hostel fee group</div>
        <p className="mb-2 text-xs text-stone-500">
          Hostel rows are keyed by group label (e.g. <span className="font-medium">I TO III</span>) and student kind.
          A row appears in the Hostel Fees table below with editable zero amounts.
        </p>
        <form
          action={addHostelStructure}
          className="grid grid-cols-1 gap-2 sm:grid-cols-[1.5fr_140px_auto]"
        >
          <input
            name="group_label"
            required
            placeholder='Group label (e.g. "I TO III")'
            className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm uppercase"
          />
          <select
            name="student_kind"
            defaultValue="new"
            className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm"
            aria-label="Student kind"
          >
            <option value="new">New students</option>
            <option value="old">Old students</option>
          </select>
          <button className="rounded-lg bg-stone-900 px-3 py-1.5 text-sm text-stone-50">
            Add hostel fee
          </button>
        </form>
      </div>

      <StructuresEditor structures={structures} />
    </div>
  );
}
