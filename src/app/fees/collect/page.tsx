import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CollectFeePicker({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; class_id?: string }>;
}) {
  const { q, class_id } = await searchParams;
  const supabase = await createClient();

  const { data: classes } = await supabase
    .from("classes")
    .select("id, display_name, ordinal")
    .order("ordinal");

  let query = supabase
    .from("students")
    .select("id, full_name, section, contact_number, father_name, classes(display_name)")
    .order("full_name")
    .limit(50);

  if (q) {
    const term = q.replace(/[%,]/g, " ").trim();
    // Match across name, mobile number, or father's name.
    query = query.or(
      `full_name.ilike.%${term}%,contact_number.ilike.%${term}%,father_name.ilike.%${term}%`
    );
  }
  if (class_id) query = query.eq("class_id", class_id);

  const { data } = await query;

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Collect Fee</h1>
        <p className="text-stone-500 text-sm">
          Find a student by name, mobile number, father&apos;s name, or class.
        </p>
      </header>

      <form action="/fees/collect" className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Name, mobile, or father's name…"
          className="flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
        />
        <select
          name="class_id"
          defaultValue={class_id ?? ""}
          className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">All classes</option>
          {(classes ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.display_name}
            </option>
          ))}
        </select>
        <button className="rounded-lg bg-stone-900 px-4 py-2 text-sm text-stone-50">
          Search
        </button>
      </form>

      <div className="card divide-y divide-stone-100">
        {(data ?? []).map((s) => {
          const klass = (s as unknown as { classes: { display_name?: string } | null }).classes;
          return (
            <Link
              key={s.id}
              href={`/fees/collect/${s.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-stone-50"
            >
              <div>
                <div className="font-medium">{s.full_name}</div>
                <div className="text-xs text-stone-500">
                  {klass?.display_name ?? "—"}
                  {s.section ? ` · ${s.section}` : ""}
                  {s.father_name ? ` · S/o ${s.father_name}` : ""}
                  {s.contact_number ? ` · ${s.contact_number}` : ""}
                </div>
              </div>
              <span className="text-stone-500 text-sm">→</span>
            </Link>
          );
        })}
        {!data?.length && (
          <div className="px-4 py-8 text-center text-stone-500 text-sm">
            {q || class_id ? "No students match." : "Search or pick a class to begin."}
          </div>
        )}
      </div>
    </div>
  );
}
