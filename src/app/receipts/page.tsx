import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { inr, formatDate } from "@/lib/utils";

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

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  let rows: Row[] = [];

  if (q && q.trim()) {
    const term = q.replace(/[%,]/g, " ").trim();
    // Search the receipt number OR the student's name (two queries, then merge:
    // a single .or() can't span the base table and an embedded table).
    const [byReceipt, byName] = await Promise.all([
      supabase
        .from("invoices")
        .select(SELECT)
        .ilike("receipt_no", `%${term}%`)
        .order("issued_at", { ascending: false })
        .limit(100),
      supabase
        .from("invoices")
        .select(SELECT.replace("students(", "students!inner("))
        .ilike("students.full_name", `%${term}%`)
        .order("issued_at", { ascending: false })
        .limit(100),
    ]);

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
    const { data } = await supabase
      .from("invoices")
      .select(SELECT)
      .order("issued_at", { ascending: false })
      .limit(100);
    rows = (data ?? []) as unknown as Row[];
  }

  return (
    <div className="max-w-6xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Receipts</h1>
        <p className="text-stone-500 text-sm">
          {q ? `Results for “${q}”.` : "Latest 100 transactions."}
        </p>
      </header>

      <form action="/receipts" className="flex gap-3 mb-4">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by student name or receipt # (e.g. 000123)…"
          className="flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
        />
        <button className="rounded-lg bg-stone-900 px-4 py-2 text-sm text-stone-50">
          Search
        </button>
        {q && (
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
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Mode</th>
              <th className="px-4 py-2 font-medium text-right">Total</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-stone-100">
                <td className="px-4 py-2 font-mono text-xs">{r.receipt_no}</td>
                <td className="px-4 py-2">{r.students?.full_name ?? "—"}</td>
                <td className="px-4 py-2">{r.students?.classes?.display_name ?? "—"}</td>
                <td className="px-4 py-2 text-stone-500">{formatDate(r.issued_at)}</td>
                <td className="px-4 py-2 capitalize">{r.payment_mode ?? "—"}</td>
                <td className="px-4 py-2 text-right font-medium">{inr(r.total)}</td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/receipts/${r.id}`} className="text-stone-900 hover:underline">
                    Open →
                  </Link>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-stone-500">
                  {q ? "No receipts match." : "No receipts yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
