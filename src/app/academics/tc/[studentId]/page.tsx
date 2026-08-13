import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole, getCurrentSchoolId } from "@/lib/auth";
import { currentAcademicYear } from "@/lib/academic-year";
import { inr } from "@/lib/utils";
import TcIssueForm from "./tc-issue-form";

export const dynamic = "force-dynamic";

export default async function TcIssuePage({ params }: { params: Promise<{ studentId: string }> }) {
  const profile = await requireRole("admin", "manager");
  const schoolId = await getCurrentSchoolId(profile);
  const { studentId } = await params;
  const supabase = await createClient();
  const AY = currentAcademicYear();

  const { data: student } = await supabase
    .from("students")
    .select("id, full_name, admission_no, section, father_name, mother_name, date_of_birth, is_hosteller, is_new_admission, bus_fee_amount, status, class_id, classes(display_name, group_label)")
    .eq("school_id", schoolId)
    .eq("id", studentId)
    .maybeSingle();
  if (!student) notFound();

  const klass = (student as unknown as { classes: { display_name: string; group_label: string | null } | null }).classes;
  const primaryKind = student.is_new_admission ? "new" : "old";

  const fetchHostel = (kind: "new" | "old") =>
    supabase.from("fee_structures").select("total_amount")
      .eq("school_id", schoolId).eq("academic_year", AY).eq("scope", "hostel")
      .eq("group_label", klass?.group_label ?? "__none__").eq("student_kind", kind)
      .order("created_at", { ascending: true }).limit(1);

  const [schoolRes, hostelPrim, hostelFall, invoicesRes, openingRes, existingRes] = await Promise.all([
    supabase.from("fee_structures").select("total_amount").eq("school_id", schoolId).eq("academic_year", AY).eq("scope", "school").eq("class_id", student.class_id).limit(1),
    klass?.group_label ? fetchHostel(primaryKind) : Promise.resolve({ data: null }),
    klass?.group_label ? fetchHostel(primaryKind === "new" ? "old" : "new") : Promise.resolve({ data: null }),
    supabase.from("invoices").select("amount_paid").eq("school_id", schoolId).eq("student_id", studentId).eq("academic_year", AY).neq("payment_status", "void"),
    supabase.from("student_opening_dues").select("amount").eq("school_id", schoolId).eq("student_id", studentId),
    supabase.from("transfer_certificates").select("id, tc_no, status").eq("school_id", schoolId).eq("student_id", studentId).eq("status", "issued").order("created_at", { ascending: false }).limit(1),
  ]);

  const schoolAnnual = Number((schoolRes.data?.[0] as { total_amount?: number } | undefined)?.total_amount ?? 0);
  const hostelAnnual = student.is_hosteller
    ? Number(((hostelPrim.data as { total_amount?: number }[] | null)?.[0] ?? (hostelFall.data as { total_amount?: number }[] | null)?.[0])?.total_amount ?? 0)
    : 0;
  const busAnnual = student.bus_fee_amount ? Number(student.bus_fee_amount) * 11 : 0;
  const paidThisAY = ((invoicesRes.data ?? []) as { amount_paid: number | string }[]).reduce((s, r) => s + Number(r.amount_paid || 0), 0);
  const openingDues = ((openingRes.data ?? []) as { amount: number | string }[]).reduce((s, r) => s + Number(r.amount || 0), 0);
  const dues = Math.max(0, schoolAnnual + hostelAnnual + busAnnual - paidThisAY) + openingDues;

  const existing = (existingRes.data ?? [])[0] as { id: string; tc_no: string | null } | undefined;

  return (
    <div className="max-w-3xl">
      <div className="mb-4"><Link href="/academics/tc" className="text-sm text-stone-600 hover:underline">← All TCs</Link></div>
      <header className="mb-6">
        <div className="text-xs text-stone-500">Transfer Certificate</div>
        <h1 className="text-2xl font-semibold tracking-tight">{student.full_name}</h1>
        <p className="text-sm text-stone-500">
          {klass?.display_name ?? "—"}{student.section ? ` · ${student.section}` : ""}
          {student.admission_no ? ` · Adm ${student.admission_no}` : ""}
          {student.status !== "active" ? " · frozen" : ""}
        </p>
      </header>

      {existing ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-4 text-sm">
          <div className="font-medium text-amber-900">A TC has already been issued for this student ({existing.tc_no}).</div>
          <Link href={`/api/transfer-certificate/${existing.id}/pdf`} className="mt-1 inline-block underline">Download TC PDF →</Link>
        </div>
      ) : (
        <>
          <div className={`mb-6 rounded-lg border px-4 py-4 ${dues > 0 ? "border-rose-300 bg-rose-50" : "border-emerald-300 bg-emerald-50"}`}>
            <div className="text-xs uppercase tracking-wide text-stone-500">No-dues check</div>
            <div className={`mt-1 text-2xl font-semibold ${dues > 0 ? "text-rose-700" : "text-emerald-700"}`}>
              {dues > 0 ? `${inr(dues)} outstanding` : "No dues"}
            </div>
            <div className="mt-1 text-xs text-stone-500">
              Session {schoolAnnual + hostelAnnual + busAnnual > 0 ? inr(schoolAnnual + hostelAnnual + busAnnual) : "—"} · Paid {inr(paidThisAY)}
              {openingDues > 0 ? ` · Carry-forward ${inr(openingDues)}` : ""}
            </div>
          </div>

          <div className="card p-5">
            <h2 className="mb-3 text-sm font-semibold text-stone-700">Certificate details</h2>
            <TcIssueForm
              studentId={student.id}
              isAdmin={profile.role === "admin"}
              defaults={{
                studying_class: klass?.display_name ?? "",
                last_exam_class: klass?.display_name ?? "",
                no_dues_amount: Math.round(dues),
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
