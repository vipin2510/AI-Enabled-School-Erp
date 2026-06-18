import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import { currentAcademicYear } from "@/lib/academic-year";
import { getLateFeeSettings } from "@/lib/cache";
import CollectForm from "./collect-form";

export const dynamic = "force-dynamic";

const STRUCT_SELECT =
  "id, scope, group_label, student_kind, total_amount, created_at, fee_structure_components(id, kind, label, period_index, amount, due_date, is_refundable, is_one_time, sort_order)";

export default async function CollectFeePage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const profile = await requireDepartment("fees");
  const schoolId = await getCurrentSchoolId(profile);
  const { studentId } = await params;
  const supabase = await createClient();
  const AY = currentAcademicYear();

  const { data: student } = await supabase
    .from("students")
    .select(
      "id, full_name, section, father_name, contact_number, is_hosteller, is_new_admission, bus_fee_amount, class_id, classes(id, code, display_name, group_label, ordinal)"
    )
    .eq("school_id", schoolId)
    .eq("id", studentId)
    .single();

  if (!student) notFound();

  const klass = (student as unknown as {
    classes: { id: string; code: string; display_name: string; group_label: string | null } | null;
  }).classes;

  // Once `student` is in hand, the remaining four reads are independent of
  // each other — fan them out in parallel instead of awaiting one after the
  // other. On a warm path with ~150ms per Supabase roundtrip, this cuts ~450ms
  // of latency off every Collect Fee open.
  const primaryHostelKind = student.is_new_admission ? "new" : "old";
  const fallbackHostelKind = primaryHostelKind === "new" ? "old" : "new";
  const fetchHostel = (kind: "new" | "old") =>
    supabase
      .from("fee_structures")
      .select(STRUCT_SELECT)
      .eq("school_id", schoolId)
      .eq("academic_year", AY)
      .eq("scope", "hostel")
      .eq("group_label", klass?.group_label ?? "__none__")
      .eq("student_kind", kind)
      .order("created_at", { ascending: true })
      .limit(1);

  const [schoolRowsRes, hostelPrimaryRes, hostelFallbackRes, paidRes, busPaidRes, lateFeeSettings] =
    await Promise.all([
      supabase
        .from("fee_structures")
        .select(STRUCT_SELECT)
        .eq("school_id", schoolId)
        .eq("academic_year", AY)
        .eq("scope", "school")
        .eq("class_id", student.class_id)
        .order("created_at", { ascending: true })
        .limit(1),
      klass?.group_label
        ? fetchHostel(primaryHostelKind)
        : Promise.resolve({ data: null, error: null }),
      klass?.group_label
        ? fetchHostel(fallbackHostelKind)
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from("invoice_items")
        .select("component_id, invoices!inner(student_id, academic_year, payment_status)")
        .eq("school_id", schoolId)
        .eq("invoices.student_id", studentId)
        .eq("invoices.academic_year", AY)
        .neq("invoices.payment_status", "void"),
      // Bus fee items live as standalone rows (component_id NULL,
      // description "Bus Fee — <Month>"). Pull their period_index so the
      // collect form can mark already-paid bus months as locked.
      supabase
        .from("invoice_items")
        .select("period_index, invoices!inner(student_id, academic_year, payment_status)")
        .eq("school_id", schoolId)
        .eq("invoices.student_id", studentId)
        .eq("invoices.academic_year", AY)
        .neq("invoices.payment_status", "void")
        .is("component_id", null)
        .like("description", "Bus Fee%"),
      getLateFeeSettings(schoolId),
    ]);

  if (schoolRowsRes.error) throw schoolRowsRes.error;
  if (paidRes.error) throw paidRes.error;

  // CollectForm expects its own (nullable) Structure shape; the Supabase
  // generic infers a `Record` here so we cast to the form's expected type.
  type StructRowAny = Parameters<typeof CollectForm>[0]["schoolStruct"];
  const schoolStruct = (schoolRowsRes.data?.[0] ?? null) as StructRowAny;
  // Pick the primary hostel structure if one matched; otherwise fall back to
  // the other admission kind. Both queries already ran in parallel — we just
  // pick the winner here.
  const hostelStruct = (klass?.group_label
    ? ((hostelPrimaryRes.data as unknown as Array<unknown> | null)?.[0] ??
        (hostelFallbackRes.data as unknown as Array<unknown> | null)?.[0] ??
        null)
    : null) as StructRowAny;

  const paidComponentIds = new Set(
    (paidRes.data ?? [])
      .map((r) => (r as { component_id: string | null }).component_id)
      .filter(Boolean) as string[]
  );
  const paidBusMonths = Array.from(
    new Set(
      ((busPaidRes.data ?? []) as { period_index: number | null }[])
        .map((r) => r.period_index)
        .filter((m): m is number => typeof m === "number")
    )
  );

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
        paidBusMonths={paidBusMonths}
        lateFeeSettings={lateFeeSettings}
        isNewAdmission={!!student.is_new_admission}
        busFeeAmount={student.bus_fee_amount ?? null}
      />
    </div>
  );
}
