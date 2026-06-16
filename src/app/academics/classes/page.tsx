import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addClass, addSection, removeSection } from "../actions";

export const dynamic = "force-dynamic";

type SectionRow = { id: string; class_id: string; name: string };

export default async function ClassesPage() {
  const profile = await requireDepartment("academics");
  const schoolId = await getCurrentSchoolId(profile);
  const supabase = await createClient();
  const canManageClasses = profile.role !== "staff";

  const [{ data: classes }, { data: sections }] = await Promise.all([
    supabase
      .from("classes")
      .select("id, display_name, ordinal")
      .eq("school_id", schoolId)
      .order("ordinal"),
    supabase
      .from("sections")
      .select("id, class_id, name")
      .eq("school_id", schoolId)
      .order("name"),
  ]);

  const byClass = new Map<string, SectionRow[]>();
  for (const s of (sections ?? []) as SectionRow[]) {
    if (!byClass.has(s.class_id)) byClass.set(s.class_id, []);
    byClass.get(s.class_id)!.push(s);
  }

  // Pre-fill the new-class ordinal with max(existing) + 1 so adds land at the
  // end. Falls back to 1 for a fresh school with no classes yet.
  const nextOrdinal =
    (classes ?? []).reduce((max, c) => Math.max(max, c.ordinal ?? 0), 0) + 1;

  return (
    <div className="max-w-4xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Classes &amp; Sections</h1>
        <p className="text-stone-500 text-sm">
          Add new classes, then create sections within each.
        </p>
      </header>

      {canManageClasses && (
        <div className="card mb-4 p-4">
          <div className="mb-2 text-sm font-medium text-stone-700">Add a new class</div>
          <form
            action={addClass}
            className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1.5fr_120px_auto]"
          >
            <input
              name="code"
              required
              placeholder="Code (e.g. 1ST)"
              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm uppercase"
            />
            <input
              name="display_name"
              required
              placeholder='Display name (e.g. "1st")'
              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm"
            />
            <input
              name="ordinal"
              type="number"
              required
              defaultValue={nextOrdinal}
              min={1}
              step={1}
              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm"
              title="Sort order"
            />
            <button className="rounded-lg bg-stone-900 px-3 py-1.5 text-sm text-stone-50">
              Add class
            </button>
          </form>
        </div>
      )}

      {(classes ?? []).length === 0 && (
        <div className="card p-4 text-sm text-stone-500">
          No classes yet for this school.
          {canManageClasses ? " Add one above to get started." : " Ask an administrator to add classes."}
        </div>
      )}

      <div className="space-y-3">
        {(classes ?? []).map((c) => {
          const list = byClass.get(c.id) ?? [];
          return (
            <div key={c.id} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="font-medium">{c.display_name}</div>
                <form action={addSection} className="flex items-center gap-2">
                  <input type="hidden" name="class_id" value={c.id} />
                  <input
                    name="name"
                    placeholder="New section (e.g. A)"
                    required
                    className="w-44 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm"
                  />
                  <button className="rounded-lg bg-stone-900 px-3 py-1.5 text-sm text-stone-50">
                    Add
                  </button>
                </form>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {list.length === 0 && (
                  <span className="text-sm text-stone-400">No sections yet.</span>
                )}
                {list.map((s) => (
                  <span
                    key={s.id}
                    className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-sm"
                  >
                    {s.name}
                    <form action={removeSection}>
                      <input type="hidden" name="id" value={s.id} />
                      <button
                        className="text-stone-400 hover:text-red-600"
                        aria-label={`Remove section ${s.name}`}
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
