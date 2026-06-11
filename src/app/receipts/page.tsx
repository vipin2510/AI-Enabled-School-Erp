import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import { inr, formatDate, monthName, ACADEMIC_MONTHS } from "@/lib/utils";
import { StatusBadge } from "./[id]/receipt-status";

export const dynamic = "force-dynamic";

const SELECT =
  "id, receipt_no, issued_at, total, amount_paid, payment_status, payment_mode, students(full_name, classes(display_name))";

type Row = {
  id: string;
  receipt_no: string | null;
  issued_at: string;
  total: number;
  amount_paid: number;
  payment_status: string;
  payment_mode: string | null;
  students: { full_name: string; classes: { display_name?: string } | null } | null;
};

// A row when filtering by month: one line per monthly fee item, so a single
// receipt that paid May + June + July shows the student under each month.
type MonthRow = {
  invoice_id: string;
  receipt_no: string | null;
  issued_at: string;
  amount: number;
  payment_status: string;
  payment_mode: string | null;
  student_name: string;
  class_name: string;
};

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; month?: string }>;
}) {
  const profile = await requireDepartment("fees");
  const schoolId = await getCurrentSchoolId(profile);
  const { q, month } = await searchParams;
  const monthNum = month ? Number(month) : 0;
  const isMonthView = monthNum >= 1 && monthNum <= 12;
  const supabase = await createClient();

  let rows: Row[] = [];
  let monthRows: MonthRow[] = [];

  if (isMonthView) {
    // Pull every monthly fee item for the chosen month, with its receipt +
    // student. One student paying three months = three rows (one per month),
    // and they appear here in whichever month they belong to.
    const { data, error: monthErr } = await supabase
      .from("invoice_items")
      .select(
        "amount, invoices!inner(id, receipt_no, issued_at, payment_status, payment_mode, students(full_name, classes(display_name)))"
      )
      .eq("school_id", schoolId)
      .eq("kind", "monthly")
      .eq("period_index", monthNum)
      .neq("invoices.payment_status", "void")
      .limit(1000);
    if (monthErr) throw monthErr;

    const raw = (data ?? []) as unknown as {
      amount: number;
      invoices: {
        id: string;
        receipt_no: string | null;
        issued_at: string;
        payment_status: string;
        payment_mode: string | null;
        students: { full_name: string; classes: { display_name?: string } | null } | null;
      };
    }[];

    monthRows = raw
      .map((r) => ({
        invoice_id: r.invoices.id,
        receipt_no: r.invoices.receipt_no,
        issued_at: r.invoices.issued_at,
        amount: r.amount,
        payment_status: r.invoices.payment_status,
        payment_mode: r.invoices.payment_mode,
        student_name: r.invoices.students?.full_name ?? "—",
        class_name: r.invoices.students?.classes?.display_name ?? "—",
      }))
      .filter((r) =>
        q && q.trim()
          ? r.student_name.toLowerCase().includes(q.trim().toLowerCase())
          : true
      )
      .sort((a, b) => new Date(b.issued_at).getTime() - new Date(a.issued_at).getTime());
  } else if (q && q.trim()) {
    const term = q.replace(/[%,]/g, " ").trim();
    // Search the receipt number OR the student's name (two queries, then merge:
    // a single .or() can't span the base table and an embedded table).
    const [byReceipt, byName] = await Promise.all([
      supabase
        .from("invoices")
        .select(SELECT)
        .eq("school_id", schoolId)
        .ilike("receipt_no", `%${term}%`)
        .order("issued_at", { ascending: false })
        .limit(100),
      supabase
        .from("invoices")
        .select(SELECT.replace("students(", "students!inner("))
        .eq("school_id", schoolId)
        .ilike("students.full_name", `%${term}%`)
        .order("issued_at", { ascending: false })
        .limit(100),
    ]);
    if (byReceipt.error) throw byReceipt.error;
    if (byName.error) throw byName.error;

    const merged = new Map<string, Row>();
    for (const r of [
      ...((byReceipt.data ?? []) as unknown as Row[]),
      ...((byName.data ?? []) as unknown as Row[]),
    ]) {
      merged.set(r.id, r);
    }
    rows = Array.from(merged.values()).sort(
      (a, b) => new Date(b.issued_at).getTime() - new Date(a.issued_at).getTime()
    );
  } else {
    const { data, error: listErr } = await supabase
      .from("invoices")
      .select(SELECT)
      .eq("school_id", schoolId)
      .order("issued_at", { ascending: false })
      .limit(100);
    if (listErr) throw listErr;
    rows = (data ?? []) as unknown as Row[];
  }

  return (
    <div className="max-w-6xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Receipts</h1>
        <p className="text-stone-500 text-sm">
          {isMonthView
            ? `Monthly fee collected for ${monthName(monthNum)}${q ? ` · “${q}”` : ""}.`
            : q
              ? `Results for “${q}”.`
              : "Latest 100 transactions."}
        </p>
      </header>

      <form action="/receipts" className="flex flex-wrap gap-3 mb-4">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by student name or receipt # (e.g. 000123)…"
          className="flex-1 min-w-[220px] rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
        />
        <select
          name="month"
          defaultValue={month ?? ""}
          className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">All transactions</option>
          {ACADEMIC_MONTHS.map((m) => (
            <option key={m} value={m}>
              {monthName(m)}
            </option>
          ))}
        </select>
        <button className="rounded-lg bg-stone-900 px-4 py-2 text-sm text-stone-50">
          Search
        </button>
        {(q || month) && (
          <Link
            href="/receipts"
            className="rounded-lg border border-stone-200 bg-stone-100 px-4 py-2 text-sm text-stone-900 hover:bg-stone-200"
          >
            Clear
          </Link>
        )}
      </form>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-stone-500 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Receipt #</th>
              <th className="px-4 py-2 font-medium">Student</th>
              <th className="px-4 py-2 font-medium">Class</th>
              {isMonthView && <th className="px-4 py-2 font-medium">Month</th>}
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Mode</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium text-right">
                {isMonthView ? "Month Fee" : "Total"}
              </th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isMonthView
              ? monthRows.map((r, i) => (
                  <tr key={`${r.invoice_id}-${i}`} className="border-t border-stone-100">
                    <td className="px-4 py-2 font-mono text-xs">{r.receipt_no}</td>
                    <td className="px-4 py-2">{r.student_name}</td>
                    <td className="px-4 py-2">{r.class_name}</td>
                    <td className="px-4 py-2">{monthName(monthNum)}</td>
                    <td className="px-4 py-2 text-stone-500">{formatDate(r.issued_at)}</td>
                    <td className="px-4 py-2 capitalize">{r.payment_mode ?? "—"}</td>
                    <td className="px-4 py-2">
                      <StatusBadge status={r.payment_status} />
                    </td>
                    <td className="px-4 py-2 text-right font-medium">{inr(r.amount)}</td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        href={`/receipts/${r.invoice_id}`}
                        className="text-stone-900 hover:underline"
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                ))
              : rows.map((r) => (
                  <tr key={r.id} className="border-t border-stone-100">
                    <td className="px-4 py-2 font-mono text-xs">{r.receipt_no}</td>
                    <td className="px-4 py-2">{r.students?.full_name ?? "—"}</td>
                    <td className="px-4 py-2">{r.students?.classes?.display_name ?? "—"}</td>
                    <td className="px-4 py-2 text-stone-500">{formatDate(r.issued_at)}</td>
                    <td className="px-4 py-2 capitalize">{r.payment_mode ?? "—"}</td>
                    <td className="px-4 py-2">
                      <StatusBadge status={r.payment_status} />
                    </td>
                    <td className="px-4 py-2 text-right font-medium">{inr(r.total)}</td>
                    <td className="px-4 py-2 text-right">
                      <Link href={`/receipts/${r.id}`} className="text-stone-900 hover:underline">
                        Open →
                      </Link>
                    </td>
                  </tr>
                ))}
            {((isMonthView && !monthRows.length) || (!isMonthView && !rows.length)) && (
              <tr>
                <td colSpan={isMonthView ? 9 : 8} className="px-4 py-8 text-center text-stone-500">
                  {isMonthView
                    ? `No ${monthName(monthNum)} fee collected${q ? " for that name" : ""} yet.`
                    : q
                      ? "No receipts match."
                      : "No receipts yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
