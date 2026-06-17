import Link from "next/link";
import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import TimetableBuilder, { type ClassOption, type SubjectSeed } from "./timetable-builder";

export const dynamic = "force-dynamic";

export default async function TimetablePage() {
  const profile = await requireDepartment("academics");
  const schoolId = await getCurrentSchoolId(profile);
  const supabase = await createClient();

  // Pull this school's classes + their sections + subjects so the builder
  // can drive its dropdowns and pre-fill the subject rows when a class is
  // picked. All three queries are scoped to the active school.
  const [{ data: classes }, { data: sections }, { data: subjects }] = await Promise.all([
    supabase
      .from("classes")
      .select("id, display_name, ordinal")
      .eq("school_id", schoolId)
      .order("ordinal"),
    supabase
      .from("sections")
      .select("class_id, name")
      .eq("school_id", schoolId)
      .order("name"),
    supabase
      .from("subjects")
      .select("class_id, name, category")
      .eq("school_id", schoolId)
      .order("name"),
  ]);

  const sectionsByClass: Record<string, string[]> = {};
  for (const s of (sections ?? []) as { class_id: string; name: string }[]) {
    (sectionsByClass[s.class_id] ??= []).push(s.name);
  }
  const subjectsByClass: Record<string, SubjectSeed[]> = {};
  for (const s of (subjects ?? []) as { class_id: string; name: string; category: string }[]) {
    (subjectsByClass[s.class_id] ??= []).push({
      name: s.name,
      kind: s.category === "co_curricular" ? "co_curricular" : "scholastic",
    });
  }

  const classOptions = (classes ?? []) as ClassOption[];

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Timetable Generator</h1>
        <p className="mt-1 text-sm text-stone-500">
          Pick a class for this school and we&apos;ll seed the subjects from your
          Subjects screen, then generate three timetable variations. Pick the one
          you like and download it as a PDF. Nothing here is saved — refresh and
          you start over.
        </p>
      </header>

      {classOptions.length === 0 ? (
        <div className="card p-4 text-sm text-stone-500">
          No classes yet for this school. Add classes from{" "}
          <Link href="/academics/classes" className="text-accent hover:underline">
            Classes &amp; Sections
          </Link>{" "}
          first, then come back here.
        </div>
      ) : (
        <TimetableBuilder
          classes={classOptions}
          sectionsByClass={sectionsByClass}
          subjectsByClass={subjectsByClass}
        />
      )}
    </div>
  );
}
