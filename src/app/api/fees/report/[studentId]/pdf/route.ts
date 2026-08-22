import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { assetDataUrl } from "@/lib/pdf-assets";
import { createClient } from "@/lib/supabase/server";
import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import { findSchool, findGroup, DEMO_GROUP } from "@/lib/access";
import { makeDemoSchool } from "@/lib/demo";
import { currentAcademicYear } from "@/lib/academic-year";
import {
  FeeReportPdf,
  type FeeReportData,
  type FeeReportRow,
} from "@/components/fee-report-pdf";
import { type ReceiptBranding } from "@/components/receipt-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Component = {
  id: string;
  kind: string;
  label: string;
  period_index: number | null;
  amount: number | string;
  sort_order: number | null;
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const profile = await requireDepartment("fees");
  const schoolId = await getCurrentSchoolId(profile);
  const { studentId } = await params;
  const supabase = await createClient();
  const AY = currentAcademicYear();

  const { data: student } = await supabase
    .from("students")
    .select(
      "id, full_name, admission_no, section, father_name, contact_number, class_id, is_hosteller, is_new_admission, bus_fee_amount, fee_kind, classes(display_name, group_label)",
    )
    .eq("school_id", schoolId)
    .eq("id", studentId)
    .single();
  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

  const klass = (student as unknown as {
    classes: { display_name: string; group_label: string | null } | null;
  }).classes;

  const [schoolRes, hostelRes, paidItemsRes, invoicesRes, openingRes] = await Promise.all([
    supabase
      .from("fee_structures")
      .select("total_amount, fee_structure_components(id, kind, label, period_index, amount, sort_order)")
      .eq("school_id", schoolId)
      .eq("academic_year", AY)
      .eq("scope", "school")
      .eq("class_id", student.class_id)
      .order("created_at", { ascending: true })
      .limit(1),
    student.is_hosteller && klass?.group_label
      ? supabase
          .from("fee_structures")
          .select("total_amount")
          .eq("school_id", schoolId)
          .eq("academic_year", AY)
          .eq("scope", "hostel")
          .eq("group_label", klass.group_label)
          .order("created_at", { ascending: true })
          .limit(1)
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("invoice_items")
      .select("component_id, period_index, description, invoices!inner(student_id, academic_year, payment_status)")
      .eq("school_id", schoolId)
      .eq("invoices.student_id", studentId)
      .eq("invoices.academic_year", AY)
      .neq("invoices.payment_status", "void"),
    supabase
      .from("invoices")
      .select("receipt_no, issued_at, payment_mode, amount_paid")
      .eq("school_id", schoolId)
      .eq("student_id", studentId)
      .eq("academic_year", AY)
      .neq("payment_status", "void")
      .order("issued_at", { ascending: false }),
    supabase
      .from("student_opening_dues")
      .select("amount")
      .eq("school_id", schoolId)
      .eq("student_id", studentId),
  ]);

  const schoolStruct = (schoolRes.data?.[0] ?? null) as
    | { total_amount: number | string; fee_structure_components: Component[] | null }
    | null;
  const components = (schoolStruct?.fee_structure_components ?? []).slice().sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );

  const paidComponentIds = new Set(
    ((paidItemsRes.data ?? []) as { component_id: string | null }[])
      .map((r) => r.component_id)
      .filter(Boolean) as string[],
  );
  const paidBusMonths = new Set(
    ((paidItemsRes.data ?? []) as { period_index: number | null; description: string | null }[])
      .filter((r) => (r.description ?? "").startsWith("Bus Fee"))
      .map((r) => r.period_index)
      .filter((m): m is number => typeof m === "number"),
  );

  // Applicable one-time components: registration/admission only for "new".
  const effectiveNew =
    ((student.fee_kind as "new" | "old" | null) ?? (student.is_new_admission ? "new" : "old")) === "new";
  const isApplicable = (c: Component) =>
    c.kind === "registration" || c.kind === "admission_one_time" ? effectiveNew : true;

  const oneTime: FeeReportRow[] = components
    .filter((c) => c.period_index == null && isApplicable(c))
    .map((c) => ({ label: c.label, amount: Number(c.amount) || 0, paid: paidComponentIds.has(c.id) }));

  const monthly: FeeReportRow[] = components
    .filter((c) => c.kind === "monthly" && c.period_index != null)
    .sort((a, b) => (a.period_index ?? 0) - (b.period_index ?? 0))
    .map((c) => ({ label: c.label, amount: Number(c.amount) || 0, paid: paidComponentIds.has(c.id) }));

  const perMonthBus = Number(student.bus_fee_amount) || 0;
  const busLine =
    perMonthBus > 0
      ? `Bus Fee: ${paidBusMonths.size} of 11 months paid · ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(perMonthBus)}/month`
      : null;

  const receipts = ((invoicesRes.data ?? []) as FeeReportData["receipts"]).map((r) => ({
    receipt_no: r.receipt_no,
    issued_at: r.issued_at,
    payment_mode: r.payment_mode,
    amount_paid: Number(r.amount_paid) || 0,
  }));

  const paid = receipts.reduce((s, r) => s + r.amount_paid, 0);
  const schoolAnnual = Number(schoolStruct?.total_amount ?? 0);
  const hostelAnnual = student.is_hosteller
    ? Number(((hostelRes.data as { total_amount?: number | string }[] | null)?.[0]?.total_amount) ?? 0)
    : 0;
  const busAnnual = perMonthBus * 11;
  const annual = schoolAnnual + hostelAnnual + busAnnual;
  const openingDues = ((openingRes.data ?? []) as { amount: number | string }[]).reduce(
    (s, r) => s + (Number(r.amount) || 0),
    0,
  );
  const outstanding = Math.max(0, annual - paid) + openingDues;

  const school = profile.is_demo ? makeDemoSchool(schoolId) : findSchool(schoolId);
  const group = profile.is_demo ? DEMO_GROUP : school ? findGroup(school.groupId) : null;
  const logoDataUrl = await assetDataUrl(group?.logoPath ?? "/letterhead/aps-logo.jpeg");
  const branding: ReceiptBranding | undefined = school
    ? {
        name: school.name.toUpperCase(),
        line1: school.board
          ? `Affiliated to ${school.board} Board · ${school.location}`
          : school.location,
        line2:
          [school.boardCode ? `Code: ${school.boardCode}` : null, school.mobile]
            .filter(Boolean)
            .join(" · ") || undefined,
      }
    : undefined;

  const data: FeeReportData = {
    student: {
      full_name: student.full_name,
      admission_no: student.admission_no ?? null,
      class_name: klass?.display_name ?? "—",
      section: student.section ?? null,
      father_name: student.father_name ?? null,
      contact_number: student.contact_number ?? null,
    },
    academicYear: AY,
    oneTime,
    monthly,
    busLine,
    receipts,
    totals: { annual, paid, openingDues, outstanding },
    generatedOn: new Date().toISOString(),
  };

  const buf = await renderToBuffer(FeeReportPdf({ data, logoDataUrl, branding }) as never);
  const safeName = student.full_name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="fee-statement-${safeName}.pdf"`,
    },
  });
}
