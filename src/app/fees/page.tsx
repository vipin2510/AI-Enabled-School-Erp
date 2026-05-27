import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireDepartment } from "@/lib/auth";
import { inr, monthName, ACADEMIC_MONTHS } from "@/lib/utils";

export const dynamic = "force-dynamic";

const AY = "2026-27";

type RecentInvoice = {
  receipt_no: string | null;
  total: number;
  issued_at: string;
  students: { full_name: string } | null;
};

export default async function FeesDashboard() {
  await requireDepartment("fees");
  const supabase = await createClient();

  const now = new Date();
  const monthIndex = now.getMonth() + 1; // 1..12, matches monthly component period_index
  const monthLabel = now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  const [studentsRes, structRes, paidRes, todayRes] = await Promise.all([
    supabase.from("students").select("id, class_id").eq("status", "active"),
    supabase
      .from("fee_structures")
      .select("class_id, fee_structure_components(kind, amount)")
      .eq("academic_year", AY)
      .eq("scope", "school"),
    supabase
      .from("invoice_items")
      .select("invoices!inner(student_id, academic_year, payment_status)")
      .eq("kind", "monthly")
      .eq("period_index", monthIndex)
      .eq("invoices.academic_year", AY)
      .neq("invoices.payment_status", "void"),
    supabase
      .from("invoices")
      .select("total, receipt_no, issued_at, students(full_name)")
      .order("issued_at", { ascending: false })
      .limit(5),
  ]);

  const students = studentsRes.data ?? [];
  const totalStudents = students.length;

  const monthlyByClass = new Map<string, number>();
  for (const s of (structRes.data ?? []) as unknown as {
    class_id: string | null;
    fee_structure_components: { kind: string; amount: number }[];
  }[]) {
    if (!s.class_id) continue;
    const m = s.fee_structure_components.find((c) => c.kind === "monthly");
    monthlyByClass.set(s.class_id, Number(m?.amount ?? 0));
  }

  const paidSet = new Set(
    ((paidRes.data ?? []) as unknown as { invoices: { student_id: string } }[]).map(
      (r) => r.invoices.student_id
    )
  );

  const paidCount = students.filter((s) => paidSet.has(s.id)).length;
  const unpaidCount = totalStudents - paidCount;
  const outstanding = students
    .filter((s) => !paidSet.has(s.id))
    .reduce((sum, s) => sum + (s.class_id ? monthlyByClass.get(s.class_id) ?? 0 : 0), 0);

  const recent = (todayRes.data ?? []) as unknown as RecentInvoice[];

  return (
    <div className="max-w-6xl">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Fees Dashboard</h1>
        <p className="text-stone-500 text-sm">
          Adeshwar Public School, Kondagaon — {monthLabel}
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card title={`Students Paid · ${monthLabel}`} value={`${paidCount} / ${totalStudents}`} tone="emerald" />
        <Card title={`Students Unpaid · ${monthLabel}`} value={unpaidCount} tone="amber" />
        <Card title={`Outstanding · ${monthLabel}`} value={inr(outstanding)} tone="rose" />
      </div>

      <section className="mt-8">
        <div className="card p-5">
          <h2 className="text-lg font-medium">Export Pending Fees</h2>
          <p className="text-stone-500 text-sm mb-3">
            Download a class-wise list of students who haven&apos;t paid a given month&apos;s
            fee — with name and mobile number.
          </p>
          <form
            action="/api/exports/pending"
            method="GET"
            className="flex flex-wrap items-center gap-3"
          >
            <select
              name="month"
              defaultValue={monthIndex}
              className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
            >
              {ACADEMIC_MONTHS.map((m) => (
                <option key={m} value={m}>
                  {monthName(m)}
                </option>
              ))}
            </select>
            <button className="rounded-lg bg-stone-900 px-4 py-2 text-sm text-stone-50">
              Download CSV
            </button>
          </form>
        </div>
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-medium">Recent Receipts</h2>
          <Link href="/receipts" className="text-sm text-stone-600 hover:underline">
            View all →
          </Link>
        </div>
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-stone-500 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Receipt #</th>
                <th className="px-4 py-2 font-medium">Student</th>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-stone-500">
                    No receipts yet.
                  </td>
                </tr>
              )}
              {recent.map((r, i) => (
                <tr key={r.receipt_no ?? i} className="border-t border-stone-100">
                  <td className="px-4 py-2 font-mono text-xs">{r.receipt_no}</td>
                  <td className="px-4 py-2">{r.students?.full_name ?? "—"}</td>
                  <td className="px-4 py-2 text-stone-500">
                    {new Date(r.issued_at).toLocaleDateString("en-IN")}
                  </td>
                  <td className="px-4 py-2 text-right font-medium">{inr(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Card({
  title,
  value,
  tone,
}: {
  title: string;
  value: string | number;
  tone: "emerald" | "amber" | "rose";
}) {
  const accent = {
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    rose: "text-rose-700",
  }[tone];
  return (
    <div className="card p-5">
      <div className="text-xs uppercase tracking-wide text-stone-500">{title}</div>
      <div className={`mt-2 text-2xl font-semibold ${accent}`}>{value}</div>
    </div>
  );
}
