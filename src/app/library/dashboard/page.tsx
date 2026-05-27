import { requireDepartment } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import StatCard from "@/components/stat-card";
import { addBookRequest, setBookRequestStatus, deleteBookRequest } from "../actions";

export const dynamic = "force-dynamic";

type BookRequest = {
  id: string;
  title: string;
  author: string | null;
  requested_for: string | null;
  note: string | null;
  status: "open" | "fulfilled";
  created_at: string;
};

const field =
  "rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900";

export default async function LibraryDashboard() {
  await requireDepartment("library");
  const supabase = await createClient();

  const [booksRes, issuedRes, overdueRes, reqRes] = await Promise.all([
    supabase.from("books").select("id", { count: "exact", head: true }),
    supabase.from("book_loans").select("id", { count: "exact", head: true }).is("returned_at", null),
    supabase
      .from("book_loans")
      .select("id", { count: "exact", head: true })
      .is("returned_at", null)
      .lt("due_date", new Date().toISOString().slice(0, 10)),
    supabase
      .from("book_requests")
      .select("id, title, author, requested_for, note, status, created_at")
      .order("status", { ascending: true })
      .order("created_at", { ascending: false }),
  ]);

  const totalBooks = booksRes.count ?? 0;
  const issued = issuedRes.count ?? 0;
  const overdue = overdueRes.count ?? 0;
  const available = Math.max(totalBooks - issued, 0);
  const requests = (reqRes.data ?? []) as BookRequest[];
  const openRequests = requests.filter((r) => r.status === "open");

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Library Dashboard</h1>
        <p className="text-stone-500 text-sm">Catalog at a glance and titles students have asked for.</p>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="Total Books" value={totalBooks} icon="📚" tone="violet" />
        <StatCard title="Issued Now" value={issued} hint={overdue ? `${overdue} overdue` : "none overdue"} icon="📖" tone="amber" />
        <StatCard title="Available" value={available} icon="✅" tone="emerald" />
        <StatCard title="Open Requests" value={openRequests.length} icon="📝" tone="sky" />
      </div>

      <section className="mt-10 card p-5">
        <h2 className="text-lg font-medium">Request a Book</h2>
        <p className="mb-4 text-sm text-stone-500">
          Log a title that isn&apos;t in the library yet but a student has asked for, so it can be
          acquired later.
        </p>
        <form action={addBookRequest} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input name="title" placeholder="Book title *" required className={field} />
          <input name="author" placeholder="Author (optional)" className={field} />
          <input name="requested_for" placeholder="Requested by (student / class)" className={field} />
          <input name="note" placeholder="Note (optional)" className={field} />
          <div className="sm:col-span-2">
            <button className="rounded-lg bg-stone-900 px-5 py-2 text-sm font-medium text-white hover:bg-stone-800">
              Add request
            </button>
          </div>
        </form>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-medium">
          Requested Books{" "}
          <span className="text-sm font-normal text-stone-500">
            ({openRequests.length} open)
          </span>
        </h2>
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-5 py-2 font-medium">Title</th>
                <th className="px-3 py-2 font-medium">Requested by</th>
                <th className="px-3 py-2 font-medium">Added</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-t border-stone-100">
                  <td className="px-5 py-2">
                    <div className="font-medium text-stone-800">{r.title}</div>
                    {r.author && <div className="text-xs text-stone-400">{r.author}</div>}
                    {r.note && <div className="text-xs text-stone-500">{r.note}</div>}
                  </td>
                  <td className="px-3 py-2 text-stone-600">{r.requested_for ?? "—"}</td>
                  <td className="px-3 py-2 text-stone-500">{formatDate(r.created_at)}</td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        "rounded-full border px-2 py-0.5 text-xs " +
                        (r.status === "open"
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700")
                      }
                    >
                      {r.status === "open" ? "Open" : "Acquired"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-3">
                      <form action={setBookRequestStatus}>
                        <input type="hidden" name="id" value={r.id} />
                        <input
                          type="hidden"
                          name="status"
                          value={r.status === "open" ? "fulfilled" : "open"}
                        />
                        <button className="text-xs font-medium text-stone-700 hover:underline">
                          {r.status === "open" ? "Mark acquired" : "Reopen"}
                        </button>
                      </form>
                      <form action={deleteBookRequest}>
                        <input type="hidden" name="id" value={r.id} />
                        <button className="text-xs text-rose-600 hover:underline">Delete</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {!requests.length && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-stone-500">
                    No book requests yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
