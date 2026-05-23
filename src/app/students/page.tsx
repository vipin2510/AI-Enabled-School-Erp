import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function StudentsList({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; class?: string }>;
}) {
  const { q, class: classFilter } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("students")
    .select("id, full_name, section, father_name, contact_number, classes(code, display_name, ordinal)")
    .order("full_name", { ascending: true })
    .limit(500);

  if (q) query = query.ilike("full_name", `%${q}%`);
  if (classFilter) query = query.eq("class_id", classFilter);

  const { data: students } = await query;
  const { data: classes } = await supabase
    .from("classes")
    .select("id, display_name, ordinal")
    .order("ordinal");

  return (
    <div className="max-w-6xl">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Students</h1>
          <p className="text-stone-500 text-sm">{students?.length ?? 0} shown</p>
        </div>
      </header>

      <form className="flex gap-3 mb-4" action="/students">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by name…"
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
        <button className="rounded-lg bg-stone-900 px-4 py-2 text-sm text-stone-50">
          Filter
        </button>
      </form>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-stone-500 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Class</th>
              <th className="px-4 py-2 font-medium">Father</th>
              <th className="px-4 py-2 font-medium">Contact</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(students ?? []).map((s) => {
              const klass = (s as unknown as { classes: { display_name?: string } | null }).classes;
              return (
                <tr key={s.id} className="border-t border-stone-100">
                  <td className="px-4 py-2 font-medium">{s.full_name}</td>
                  <td className="px-4 py-2">
                    {klass?.display_name ?? "—"}
                    {s.section ? ` · ${s.section}` : ""}
                  </td>
                  <td className="px-4 py-2 text-stone-600">{s.father_name ?? "—"}</td>
                  <td className="px-4 py-2 text-stone-600">{s.contact_number ?? "—"}</td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/fees/collect/${s.id}`}
                      className="text-stone-900 hover:underline"
                    >
                      Collect fee →
                    </Link>
                  </td>
                </tr>
              );
            })}
            {!students?.length && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-stone-500">
                  No students yet. Run <code>npm run seed:students</code> to import.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
