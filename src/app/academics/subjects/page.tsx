import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addSubject, removeSubject } from "../actions";

export const dynamic = "force-dynamic";

type SubjectRow = { id: string; class_id: string; name: string };

export default async function SubjectsPage() {
  await requireRole("admin", "manager");
  const supabase = await createClient();

  const [{ data: classes }, { data: subjects }] = await Promise.all([
    supabase.from("classes").select("id, display_name, ordinal").order("ordinal"),
    supabase.from("subjects").select("id, class_id, name").order("name"),
  ]);

  const byClass = new Map<string, SubjectRow[]>();
  for (const s of (subjects ?? []) as SubjectRow[]) {
    if (!byClass.has(s.class_id)) byClass.set(s.class_id, []);
    byClass.get(s.class_id)!.push(s);
  }

  return (
    <div className="max-w-4xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Subjects</h1>
        <p className="text-stone-500 text-sm">
          Add or remove the subjects offered in each class.
        </p>
      </header>

      <div className="space-y-3">
        {(classes ?? []).map((c) => {
          const list = byClass.get(c.id) ?? [];
          return (
            <div key={c.id} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="font-medium">{c.display_name}</div>
                <form action={addSubject} className="flex items-center gap-2">
                  <input type="hidden" name="class_id" value={c.id} />
                  <input
                    name="name"
                    placeholder="New subject (e.g. Mathematics)"
                    required
                    className="w-56 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm"
                  />
                  <button className="rounded-lg bg-stone-900 px-3 py-1.5 text-sm text-stone-50">
                    Add
                  </button>
                </form>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {list.length === 0 && (
                  <span className="text-sm text-stone-400">No subjects yet.</span>
                )}
                {list.map((s) => (
                  <span
                    key={s.id}
                    className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-sm"
                  >
                    {s.name}
                    <form action={removeSubject}>
                      <input type="hidden" name="id" value={s.id} />
                      <button
                        className="text-stone-400 hover:text-red-600"
                        aria-label={`Remove subject ${s.name}`}
                      >
                        ✕
                      </button>
                    </form>
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
