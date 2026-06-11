import Link from "next/link";
import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getClasses } from "@/lib/cache";
import { deleteStudent } from "./actions";
import { ConfirmButton } from "@/components/ui/confirm-button";

export const dynamic = "force-dynamic";

// Server-side pagination: only this many rows hit the wire per page. Bumping
// it raises payload weight linearly, so keep it small enough to stay snappy on
// 3G but large enough that admins rarely need to click Next.
const PAGE_SIZE = 50;

export default async function StudentsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; class?: string; page?: string }>;
}) {
  const profile = await requireDepartment("academics");
  const schoolId = await getCurrentSchoolId(profile);
  const { q, class: classFilter, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const supabase = await createClient();

  // Single query returning the page slice + an exact total count via the
  // PostgREST `Prefer: count=exact` header — saves a separate count round-trip.
  let query = supabase
    .from("students")
    .select(
      "id, full_name, section, father_name, contact_number, status, classes(display_name, ordinal)",
      { count: "exact" }
    )
    .eq("school_id", schoolId)
    .order("full_name", { ascending: true })
    .range(from, to);
  if (q) query = query.or(`full_name.ilike.%${q}%,admission_no.ilike.%${q}%`);
  if (classFilter) query = query.eq("class_id", classFilter);

  // Page the live student list (typed search hits this); classes dropdown is
  // cached because it changes maybe twice a year.
  const [{ data: students, count }, classes] = await Promise.all([
    query,
    getClasses(schoolId),
  ]);
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showingFrom = total === 0 ? 0 : from + 1;
  const showingTo = Math.min(from + (students?.length ?? 0), total);

  const pageHref = (n: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (classFilter) params.set("class", classFilter);
    if (n > 1) params.set("page", String(n));
    const qs = params.toString();
    return qs ? `/academics/students?${qs}` : "/academics/students";
  };

  return (
    <div className="max-w-6xl">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Students</h1>
          <p className="text-stone-500 text-sm">
            {total === 0
              ? "0 students"
              : `Showing ${showingFrom}–${showingTo} of ${total}`}
          </p>
        </div>
        <Link
          href="/academics/students/new"
          className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-stone-50"
        >
          + Add student
        </Link>
      </header>

      <form className="flex gap-3 mb-4" action="/academics/students">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by name or admission no.…"
          className="w-72 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
        />
        <select
          name="class"
          defaultValue={classFilter ?? ""}
          className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">All classes</option>
          {classes?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.display_name}
            </option>
          ))}
        </select>
        <button className="rounded-lg bg-stone-900 px-4 py-2 text-sm text-stone-50">Filter</button>
      </form>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-stone-500 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Class</th>
              <th className="px-4 py-2 font-medium">Father</th>
              <th className="px-4 py-2 font-medium">Contact</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(students ?? []).map((s) => {
              const klass = (s as unknown as { classes: { display_name?: string } | null }).classes;
              return (
                <tr key={s.id} className="border-t border-stone-100">
                  <td className="px-4 py-2 font-medium">
                    <Link href={`/academics/students/${s.id}`} className="text-stone-900 hover:text-accent hover:underline">
                      {s.full_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    {klass?.display_name ?? "—"}
                    {s.section ? ` · ${s.section}` : ""}
                  </td>
                  <td className="px-4 py-2 text-stone-600">{s.father_name ?? "—"}</td>
                  <td className="px-4 py-2 text-stone-600">{s.contact_number ?? "—"}</td>
                  <td className="px-4 py-2 capitalize text-stone-600">{s.status}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-3">
                      <Link
                        href={`/academics/students/${s.id}/edit`}
                        className="text-stone-900 hover:underline"
                      >
                        Edit
                      </Link>
                      <ConfirmButton
                        action={deleteStudent}
                        fields={{ id: s.id }}
                        label="Remove"
                        title="Remove student"
                        message={`Remove ${s.full_name}? This cannot be undone.`}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
            {!students?.length && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-stone-500">
                  No students found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm">
          <div className="text-stone-500">
            Page {page} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link
                href={pageHref(page - 1)}
                className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-stone-700 hover:bg-stone-100"
              >
                ← Prev
              </Link>
            ) : (
              <span className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-stone-400">
                ← Prev
              </span>
            )}
            {page < totalPages ? (
              <Link
                href={pageHref(page + 1)}
                className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-stone-700 hover:bg-stone-100"
              >
                Next →
              </Link>
            ) : (
              <span className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-stone-400">
                Next →
              </span>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
