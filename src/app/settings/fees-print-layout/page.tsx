import { createClient } from "@/lib/supabase/server";
import { requireRole, getCurrentSchoolId } from "@/lib/auth";
import { FEE_PRINT_DEFAULTS } from "@/lib/cache";
import FeesPrintLayoutForm from "./fees-print-layout-form";

export const dynamic = "force-dynamic";

export default async function FeesPrintLayoutPage() {
  // Print layout affects every receipt the school issues — admin/manager only.
  const profile = await requireRole("admin", "manager");
  const schoolId = await getCurrentSchoolId(profile);
  const supabase = await createClient();

  // Table may be absent on pre-migration deployments; fall back to defaults.
  let settings = { ...FEE_PRINT_DEFAULTS, id: null as string | null };
  const { data } = await supabase
    .from("fee_print_settings")
    .select("id, orientation, box_width_mm, box_height_mm, page_margin_mm, box_gap_mm, school_binding_mm")
    .eq("school_id", schoolId)
    .maybeSingle();
  if (data) {
    settings = {
      ...settings,
      id: data.id,
      orientation: data.orientation,
      box_width_mm: Number(data.box_width_mm),
      box_height_mm: Number(data.box_height_mm),
      page_margin_mm: Number(data.page_margin_mm),
      box_gap_mm: Number(data.box_gap_mm),
      school_binding_mm: Number(data.school_binding_mm),
    };
  }

  return (
    <div className="max-w-xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Receipt Print Layout</h1>
        <p className="text-stone-500 text-sm">
          Controls how fee receipts are arranged on a printed page. Each box is
          one receipt copy — the School Copy and Student Copy repeat to fill the
          grid.
        </p>
      </header>
      <FeesPrintLayoutForm settings={settings} schoolId={schoolId} />
    </div>
  );
}
