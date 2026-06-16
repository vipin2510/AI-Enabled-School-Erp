import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addSubject, removeSubject } from "../actions";

export const dynamic = "force-dynamic";

type SubjectRow = { id: string; class_id: string; name: string; category: string };

export default async function SubjectsPage() {
  const profile = await requireDepartment("academics");
  const schoolId = await getCurrentSchoolId(profile);
  const supabase = await createClient();

  const [{ data: classes }, { data: subjects }] = await Promise.all([
    supabase
      .from("classes")
      .select("id, display_name, ordinal")
      .eq("school_id", schoolId)
      .order("ordinal"),
    supabase
      .from("subjects")
      .select("id, class_id, name, category")
      .eq("school_id", schoolId)
      .order("name"),
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
          Add or remove the subjects offered in each class. Scholastic subjects are
          marked numerically; co-curricular subjects get a single A–E grade.
        </p>
      </header>

      {(classes ?? []).length === 0 && (
        <div className="card p-4 text-sm text-stone-500">
          No classes yet for this school. Add classes from{" "}
          <a href="/academics/classes" className="text-accent hover:underline">
            Classes &amp; Sections
          </a>{" "}
          first, then come back here to attach subjects.
        </div>
      )}

      <div className="space-y-3">
        {(classes ?? []).map((c) => {
          const list = byClass.get(c.id) ?? [];
          const scholastic = list.filter((s) => s.category !== "co_curricular");
          const coCurricular = list.filter((s) => s.category === "co_curricular");
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
                  <select
                    name="category"
                    defaultValue="scholastic"
                    className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm"
                    aria-label="Subject type"
                  >
                    <option value="scholastic">Scholastic</option>
                    <option value="co_curricular">Co-curricular</option>
                  </select>
                  <button className="rounded-lg bg-stone-900 px-3 py-1.5 text-sm text-stone-50">
                    Add
                  </button>
                </form>
              </div>

              <SubjectGroup label="Scholastic" list={scholastic} emptyText="No subjects yet." />
              <SubjectGroup
                label="Co-curricular"
                list={coCurricular}
                emptyText="No co-curricular subjects."
                accent
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SubjectGroup({
  label,
  list,
  emptyText,
  accent,
}: {
  label: string;
  list: SubjectRow[];
  emptyText: string;
  accent?: boolean;
}) {
  return (
    <div className="mt-3">
      <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-stone-400">
        {label}
      </div>
      <div className="flex flex-wrap gap-2">
        {list.length === 0 && <span className="text-sm text-stone-400">{emptyText}</span>}
        {list.map((s) => (
          <span
            key={s.id}
            className={
              "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm " +
              (accent
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-stone-200 bg-stone-50")
            }
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
}
