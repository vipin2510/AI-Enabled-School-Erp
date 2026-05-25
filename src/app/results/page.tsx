import Link from "next/link";
import { requireDepartment } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { currentAcademicYear } from "@/lib/results";

export const dynamic = "force-dynamic";

type SectionRow = { class_id: string; name: string };

export default async function ResultsPage() {
  await requireDepartment("results");
  const supabase = await createClient();

  const [{ data: classes }, { data: sections }] = await Promise.all([
    supabase.from("classes").select("id, display_name, ordinal").order("ordinal"),
    supabase.from("sections").select("class_id, name").order("name"),
  ]);

  const byClass = new Map<string, string[]>();
  for (const s of (sections ?? []) as SectionRow[]) {
    if (!byClass.has(s.class_id)) byClass.set(s.class_id, []);
    byClass.get(s.class_id)!.push(s.name);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Results</h1>
          <p className="mt-1 text-sm text-stone-500">
            Choose a class and section to enter marks and generate report cards.
          </p>
        </div>
        <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-medium text-stone-600">
          Academic Year {currentAcademicYear()}
        </span>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(classes ?? []).map((c) => {
          const list = byClass.get(c.id) ?? [];
          return (
            <div key={c.id} className="card flex flex-col p-5">
              <div className="mb-3 text-base font-semibold">{c.display_name}</div>
              {list.length === 0 ? (
                <p className="text-sm text-stone-400">
                  No sections.{" "}
                  <Link href="/academics/classes" className="text-accent hover:underline">
                    Add one
                  </Link>
                  .
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {list.map((sec) => (
                    <Link
                      key={sec}
                      href={`/results/${c.id}/${encodeURIComponent(sec)}`}
                      className="inline-flex items-center rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:border-stone-900 hover:bg-stone-900 hover:text-white"
                    >
                      Section {sec}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {!classes?.length && (
          <div className="card col-span-full p-8 text-center text-stone-500">
            No classes defined yet.
          </div>
        )}
      </div>
    </div>
  );
}
