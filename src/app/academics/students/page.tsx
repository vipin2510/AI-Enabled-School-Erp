import Link from "next/link";
import { requireDepartment } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deleteStudent } from "./actions";
import { ConfirmButton } from "@/components/ui/confirm-button";

export const dynamic = "force-dynamic";

export default async function StudentsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; class?: string }>;
}) {
  await requireDepartment("academics");
  const { q, class: classFilter } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("students")
    .select("id, full_name, section, father_name, contact_number, status, classes(display_name, ordinal)")
    .order("full_name", { ascending: true })
    .limit(1000);
  if (q) query = query.or(`full_name.ilike.%${q}%,admission_no.ilike.%${q}%`);
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
    </div>
  );
}
