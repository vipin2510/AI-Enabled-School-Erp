import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CollectForm from "./collect-form";

export const dynamic = "force-dynamic";

const AY = "2026-27";

const STRUCT_SELECT =
  "id, scope, group_label, student_kind, total_amount, created_at, fee_structure_components(id, kind, label, period_index, amount, due_date, is_refundable, is_one_time, sort_order)";

export default async function CollectFeePage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const supabase = await createClient();

  const { data: student } = await supabase
    .from("students")
    .select(
      "id, full_name, section, father_name, contact_number, is_hosteller, is_new_admission, class_id, classes(id, code, display_name, group_label, ordinal)"
    )
    .eq("id", studentId)
    .single();

  if (!student) notFound();

  const klass = (student as unknown as {
    classes: { id: string; code: string; display_name: string; group_label: string | null } | null;
  }).classes;

  // School fee structure for this class.
  // Use order+limit (not maybeSingle) so a stray duplicate never blanks the page.
  const { data: schoolRows } = await supabase
    .from("fee_structures")
    .select(STRUCT_SELECT)
    .eq("academic_year", AY)
    .eq("scope", "school")
    .eq("class_id", student.class_id)
    .order("created_at", { ascending: true })
    .limit(1);
  const schoolStruct = schoolRows?.[0] ?? null;

  // Hostel structure: available to ANY student whose class maps to a hostel
  // group (not only those flagged as hostellers). Pick new/old by admission.
  let hostelStruct = null;
  if (klass?.group_label) {
    const primaryKind = student.is_new_admission ? "new" : "old";
    const fetchHostel = async (kind: "new" | "old") => {
      const { data } = await supabase
        .from("fee_structures")
        .select(STRUCT_SELECT)
        .eq("academic_year", AY)
        .eq("scope", "hostel")
        .eq("group_label", klass.group_label)
        .eq("student_kind", kind)
        .order("created_at", { ascending: true })
        .limit(1);
      return data?.[0] ?? null;
    };
    hostelStruct =
      (await fetchHostel(primaryKind)) ??
      (await fetchHostel(primaryKind === "new" ? "old" : "new"));
  }

  // Already-paid components for this student in this AY.
  const { data: paidItems } = await supabase
    .from("invoice_items")
    .select("component_id, invoices!inner(student_id, academic_year, payment_status)")
    .eq("invoices.student_id", studentId)
    .eq("invoices.academic_year", AY)
    .neq("invoices.payment_status", "void");

  const paidComponentIds = new Set(
    (paidItems ?? [])
      .map((r) => (r as { component_id: string | null }).component_id)
      .filter(Boolean) as string[]
  );

  // Late-fee settings. monthly_due_day may not exist yet (pre-migration);
  // fall back gracefully so the page never crashes.
  let lateFeeSettings = {
    per_day_amount: 100,
    grace_days: 0,
    is_enabled: true,
    monthly_due_day: 10,
  };
  const withDay = await supabase
    .from("late_fee_settings")
    .select("per_day_amount, grace_days, is_enabled, monthly_due_day")
    .maybeSingle();
  if (!withDay.error && withDay.data) {
    lateFeeSettings = { ...lateFeeSettings, ...withDay.data };
  } else {
    const basic = await supabase
      .from("late_fee_settings")
      .select("per_day_amount, grace_days, is_enabled")
      .maybeSingle();
    if (basic.data) lateFeeSettings = { ...lateFeeSettings, ...basic.data };
  }

  return (
    <div className="max-w-5xl">
      <header className="mb-6">
        <div className="text-xs text-stone-500">Collect Fee</div>
        <h1 className="text-2xl font-semibold tracking-tight">{student.full_name}</h1>
        <p className="text-stone-500 text-sm">
          {klass?.display_name ?? "—"}{student.section ? ` · Section ${student.section}` : ""}
          {student.is_hosteller ? " · Hosteller" : ""}
          {student.is_new_admission ? " · New Admission" : ""}
        </p>
      </header>

      <CollectForm
        studentId={student.id}
        studentName={student.full_name}
        academicYear={AY}
        schoolStruct={schoolStruct}
        hostelStruct={hostelStruct}
        hostelDefaultOpen={student.is_hosteller}
        paidComponentIds={Array.from(paidComponentIds)}
        lateFeeSettings={lateFeeSettings}
        isNewAdmission={!!student.is_new_admission}
      />
    </div>
  );
}
