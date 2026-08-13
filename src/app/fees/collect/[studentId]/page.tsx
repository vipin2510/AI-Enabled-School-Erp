import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import { currentAcademicYear } from "@/lib/academic-year";
import { getLateFeeSettings } from "@/lib/cache";
import CollectForm from "./collect-form";
import FeeKindControl from "./fee-kind-control";

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
      "id, full_name, section, father_name, contact_number, is_hosteller, is_new_admission, category, bus_fee_amount, class_id, status, fee_kind, classes(id, code, display_name, group_label, ordinal)"
    )
    .eq("school_id", schoolId)
    .eq("id", studentId)
    .single();

  if (!student) notFound();

  // Frozen students (e.g. after a TC was issued) can't be collected from — only
  // their history remains. Show a notice instead of the collect form.
  if (student.status !== "active") {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">{student.full_name}</h1>
        <div className="mt-4 rounded-lg border border-stone-300 bg-stone-50 px-4 py-4 text-sm text-stone-700">
          This student is <strong>frozen</strong> ({student.status}) and can no longer be collected from
          — typically because a Transfer Certificate has been issued. Past receipts remain viewable under Receipts.
        </div>
      </div>
    );
  }

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

  const [schoolRowsRes, hostelPrimaryRes, hostelFallbackRes, paidRes, busPaidRes, invoicesRes, openingDuesRes, lateFeeSettings] =
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
      // For the header totals: sum across this student's non-void invoices
      // in the current academic year.
      supabase
        .from("invoices")
        .select("amount_paid")
        .eq("school_id", schoolId)
        .eq("student_id", studentId)
        .eq("academic_year", AY)
        .neq("payment_status", "void"),
      // Carry-forward opening dues (imported from a prior session's balance
      // sheet). Summed across any years and added to Outstanding. Tolerant of
      // the table not existing on pre-migration deployments.
      supabase
        .from("student_opening_dues")
        .select("amount")
        .eq("school_id", schoolId)
        .eq("student_id", studentId),
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

  // Header totals for this student in the current AY.
  //   • paid    = sum of every non-void invoice's amount_paid
  //   • annual  = school structure total + hostel structure total (if a
  //               hosteller) + 11 × bus rate (April is hidden from the
  //               collect screen so it doesn't count here)
  //   • due     = max(0, annual − paid)
  // The annual figure ignores whether a one-time/new-admission component
  // actually applies — admin can override on the form. The collect form
  // itself still drives accurate per-receipt totals.
  const paidThisAY = (
    (invoicesRes.data ?? []) as { amount_paid: number | string }[]
  ).reduce((s, r) => s + Number(r.amount_paid || 0), 0);
  const schoolAnnual = Number(schoolStruct?.total_amount ?? 0);
  const hostelAnnual = student.is_hosteller ? Number(hostelStruct?.total_amount ?? 0) : 0;
  const busAnnual = student.bus_fee_amount ? Number(student.bus_fee_amount) * 11 : 0;
  const annualTotal = schoolAnnual + hostelAnnual + busAnnual;
  // Carry-forward dues from a prior session (imported balance sheet). Added on
  // top of this session's outstanding so the cashier sees the full amount owed.
  const openingDues = (
    (openingDuesRes.data ?? []) as { amount: number | string }[]
  ).reduce((s, r) => s + Number(r.amount || 0), 0);
  const outstanding = Math.max(0, annualTotal - paidThisAY) + openingDues;
  const inr = (n: number) =>
    `₹${Math.round(n).toLocaleString("en-IN")}`;

  // Effective fee kind: the saved per-student choice wins; until it's set we
  // fall back to the is_new_admission flag. This gates one-time charges in the
  // form (registration/admission only for "new").
  const feeKind: "new" | "old" | null =
    (student.fee_kind as "new" | "old" | null) ?? null;
  const effectiveNew = (feeKind ?? (student.is_new_admission ? "new" : "old")) === "new";

  return (
    <div className="max-w-5xl">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs text-stone-500">Collect Fee</div>
          <h1 className="text-2xl font-semibold tracking-tight">{student.full_name}</h1>
          <p className="text-stone-500 text-sm">
            {klass?.display_name ?? "—"}{student.section ? ` · Section ${student.section}` : ""}
            {student.is_hosteller ? " · Hosteller" : ""}
            {student.is_new_admission ? " · New Admission" : ""}
          </p>
          <div className="mt-2 max-w-[220px]">
            <FeeKindControl studentId={student.id} current={feeKind} isAdmin={profile.role === "admin"} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-right text-xs">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-emerald-700">Paid this session</div>
            <div className="mt-0.5 text-base font-semibold tabular-nums text-emerald-800">
              {inr(paidThisAY)}
            </div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-amber-700">Outstanding</div>
            <div className="mt-0.5 text-base font-semibold tabular-nums text-amber-800">
              {annualTotal > 0 || openingDues > 0 ? inr(outstanding) : "—"}
            </div>
            {openingDues > 0 && (
              <div className="text-[10px] text-amber-700">incl. {inr(openingDues)} b/f</div>
            )}
          </div>
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-stone-500">Session total</div>
            <div className="mt-0.5 text-base font-semibold tabular-nums text-stone-700">
              {annualTotal > 0 ? inr(annualTotal) : "—"}
            </div>
          </div>
        </div>
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
        isNewAdmission={effectiveNew}
        studentCategory={(student.category ?? "regular") as "regular" | "rte" | "staff_child"}
        busFeeAmount={student.bus_fee_amount ?? null}
        defaultCollectedBy={profile.full_name ?? ""}
      />
    </div>
  );
}
