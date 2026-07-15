import Link from "next/link";
import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DAYS } from "@/lib/timetable";
import TimetableBuilder, {
  type Teacher,
  type TimetableSlotSeed,
} from "./timetable-builder";

export const dynamic = "force-dynamic";

type ClassRow = { id: string; display_name: string; ordinal: number };

export default async function TimetablePage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string; section?: string }>;
}) {
  const profile = await requireDepartment("academics");
  const schoolId = await getCurrentSchoolId(profile);
  const supabase = await createClient();
  const sp = await searchParams;
  const classId = sp.classId ?? "";
  const section = sp.section ?? "";

  const [{ data: classes }, { data: sections }, { data: teachers }] = await Promise.all([
    supabase.from("classes").select("id, display_name, ordinal").eq("school_id", schoolId).order("ordinal"),
    supabase.from("sections").select("class_id, name").eq("school_id", schoolId).order("name"),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("group_id", profile.group_id)
      .eq("is_active", true)
      .contains("school_ids", [schoolId])
      .order("full_name"),
  ]);

  const classOptions = (classes ?? []) as ClassRow[];
  const teacherList = ((teachers ?? []) as { id: string; full_name: string | null }[]).map(
    (t): Teacher => ({ id: t.id, name: t.full_name || "(unnamed)" })
  );
  const sectionsByClass: Record<string, string[]> = {};
  for (const s of (sections ?? []) as { class_id: string; name: string }[]) {
    (sectionsByClass[s.class_id] ??= []).push(s.name);
  }

  // Load the selected class's subjects, class teacher and existing grid.
  let subjects: string[] = [];
  let classTeacherName: string | null = null;
  let initialSlots: TimetableSlotSeed[] = [];
  const selectedClass = classOptions.find((c) => c.id === classId) ?? null;

  if (selectedClass) {
    const [{ data: subs }, { data: ct }, { data: slots }] = await Promise.all([
      supabase.from("subjects").select("name").eq("school_id", schoolId).eq("class_id", classId).order("name"),
      supabase
        .from("class_teachers")
        .select("teacher_id")
        .eq("school_id", schoolId)
        .eq("class_id", classId)
        .eq("section", section)
        .maybeSingle(),
      supabase
        .from("timetable_slots")
        .select("day, period, subject_name, teacher_id")
        .eq("school_id", schoolId)
        .eq("class_id", classId)
        .eq("section", section),
    ]);
    subjects = ((subs ?? []) as { name: string }[]).map((s) => s.name);
    initialSlots = (slots ?? []) as TimetableSlotSeed[];
    if (ct?.teacher_id) {
      classTeacherName = teacherList.find((t) => t.id === ct.teacher_id)?.name ?? null;
    }
  }

  const field = "rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm";

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Timetable</h1>
        <p className="mt-1 text-sm text-stone-500">
          Build and save each class&apos;s weekly timetable. Period 1 every day is the class
          teacher (set in{" "}
          <Link href="/academics/signatures" className="text-accent hover:underline">
            Signatures
          </Link>
          ). Mon–Fri run 8 periods, Saturday 5. Download class-wise or teacher-wise PDFs.
        </p>
      </header>

      {classOptions.length === 0 ? (
        <div className="card p-4 text-sm text-stone-500">
          No classes yet for this school. Add classes from{" "}
          <Link href="/academics/classes" className="text-accent hover:underline">
            Classes &amp; Sections
          </Link>{" "}
          first.
        </div>
      ) : (
        <>
          {/* Class + section picker (navigates via query params). */}
          <form method="get" className="card mb-5 flex flex-wrap items-end gap-3 p-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-stone-500">Class</span>
              <select name="classId" defaultValue={classId} className={field}>
                <option value="">— pick a class —</option>
                {classOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.display_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-stone-500">Section</span>
              <select name="section" defaultValue={section} className={field}>
                <option value="">— none —</option>
                {(sectionsByClass[classId] ?? []).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <button className="rounded-lg bg-stone-900 px-4 py-2 text-sm text-stone-50">Open</button>
          </form>

          {selectedClass ? (
            <TimetableBuilder
              classId={classId}
              section={section}
              className={`${selectedClass.display_name}${section ? ` · ${section}` : ""}`}
              subjects={subjects}
              teachers={teacherList}
              classTeacherName={classTeacherName}
              initialSlots={initialSlots}
              days={DAYS}
            />
          ) : (
            <div className="card p-4 text-sm text-stone-500">
              Pick a class (and section) above to edit its timetable.
            </div>
          )}

          {/* Teacher-wise PDF — spans all classes for the chosen teacher. */}
          <div className="card mt-5 p-4">
            <div className="mb-2 font-medium">Teacher-wise timetable</div>
            <p className="mb-3 text-sm text-stone-500">
              A single teacher&apos;s periods across every class they teach (including class-teacher
              first periods).
            </p>
            <form method="get" action="/api/academics/timetable/teacher" className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-stone-500">Teacher</span>
                <select name="teacherId" className={field} required defaultValue="">
                  <option value="" disabled>
                    — pick a teacher —
                  </option>
                  {teacherList.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <button className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
                ⤓ Download teacher PDF
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
