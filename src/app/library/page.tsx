import { requireDepartment } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { todayStr } from "@/lib/attendance";
import ScanDesk from "./scan-desk";

export const dynamic = "force-dynamic";

type OpenLoan = {
  id: string;
  issued_at: string;
  due_date: string | null;
  books: { code: string; title: string } | null;
  students: { full_name: string; section: string | null; classes: { display_name: string } | null } | null;
};

export default async function LibraryPage() {
  await requireDepartment("library");
  const supabase = await createClient();

  const { data: loans } = await supabase
    .from("book_loans")
    .select("id, issued_at, due_date, books(code, title), students(full_name, section, classes(display_name))")
    .is("returned_at", null)
    .order("issued_at", { ascending: false })
    .limit(100);

  const today = todayStr();
  const openLoans = (loans ?? []) as unknown as OpenLoan[];

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Issue / Return</h1>
        <p className="mt-1 text-sm text-stone-500">
          Scan a book’s QR label (or type its code) to issue it to a student or take it back.
        </p>
      </header>

      <ScanDesk />

      <div className="card mt-6 overflow-hidden p-0">
        <div className="px-5 py-3 text-sm font-semibold text-stone-800">
          Currently issued ({openLoans.length})
        </div>
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-5 py-2 font-medium">Book</th>
              <th className="px-3 py-2 font-medium">Student</th>
              <th className="px-3 py-2 font-medium">Issued</th>
              <th className="px-3 py-2 font-medium">Due</th>
            </tr>
          </thead>
          <tbody>
            {openLoans.map((l) => {
              const overdue = l.due_date && l.due_date < today;
              return (
                <tr key={l.id} className="border-t border-stone-100">
                  <td className="px-5 py-2">
                    <div className="font-medium">{l.books?.title ?? "—"}</div>
                    <div className="font-mono text-xs text-stone-400">{l.books?.code}</div>
                  </td>
                  <td className="px-3 py-2 text-stone-700">
                    {l.students?.full_name ?? "—"}
                    {l.students?.classes?.display_name ? (
                      <span className="text-xs text-stone-400">
                        {" "}· {l.students.classes.display_name}
                        {l.students.section ? ` · ${l.students.section}` : ""}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-stone-600">{formatDate(l.issued_at)}</td>
                  <td className={"px-3 py-2 " + (overdue ? "font-medium text-red-600" : "text-stone-600")}>
                    {l.due_date ?? "—"}
                    {overdue ? " · overdue" : ""}
                  </td>
                </tr>
              );
            })}
            {openLoans.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-stone-500">
                  No books are currently issued.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
