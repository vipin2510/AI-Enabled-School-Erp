import Link from "next/link";
import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getClasses, getSections, getSubjects, getTeachers } from "@/lib/cache";
import { DAYS } from "@/lib/timetable";
import TimetableBuilder, {
  type Teacher,
  type TimetableSlotSeed,
} from "./timetable-builder";
import TimetablePicker from "./picker";

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

  // Reference data (classes/sections/teachers) is cached per-school — it changes
  // a couple of times a year, so there's no reason to re-query it on every open.
  const [classes, sections, teachers] = await Promise.all([
    getClasses(schoolId),
    getSections(schoolId),
    getTeachers(schoolId, profile.group_id),
  ]);

  const classOptions = classes as ClassRow[];
  const teacherList = teachers.map(
    (t): Teacher => ({ id: t.id, name: t.full_name || "(unnamed)" })
  );
  const sectionsByClass: Record<string, string[]> = {};
  for (const s of sections) {
    (sectionsByClass[s.class_id] ??= []).push(s.name);
  }

  // Load the selected class's subjects and both timetable grids (regular +
  // remedial) plus the remedial validity window.
  let subjects: string[] = [];
  let regularSlots: TimetableSlotSeed[] = [];
  let remedialSlots: TimetableSlotSeed[] = [];
  let remedialStart: string | null = null;
  let remedialEnd: string | null = null;
  const selectedClass = classOptions.find((c) => c.id === classId) ?? null;

  if (selectedClass) {
    // Subjects are cached reference data; the timetable slots + remedial window
    // are live (they change on every save) so they stay on the request client.
    const [allSubjects, { data: slots }, { data: remMeta }] = await Promise.all([
      getSubjects(schoolId),
      supabase
        .from("timetable_slots")
        .select("day, period, subject_name, teacher_id, kind")
        .eq("school_id", schoolId)
        .eq("class_id", classId)
        .eq("section", section),
      supabase
        .from("remedial_timetables")
        .select("start_date, end_date")
        .eq("school_id", schoolId)
        .eq("class_id", classId)
        .eq("section", section)
        .maybeSingle(),
    ]);
    subjects = allSubjects.filter((s) => s.class_id === classId).map((s) => s.name);
    const allSlots = (slots ?? []) as (TimetableSlotSeed & { kind?: string })[];
    regularSlots = allSlots.filter((s) => (s.kind ?? "regular") !== "remedial");
    remedialSlots = allSlots.filter((s) => s.kind === "remedial");
    remedialStart = remMeta?.start_date ?? null;
    remedialEnd = remMeta?.end_date ?? null;
  }

  const field = "rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm";

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Timetable</h1>
        <p className="mt-1 text-sm text-stone-500">
          Build and save each class&apos;s weekly timetable. Every period is editable. Switch to
          the <span className="font-medium">Remedial</span> tab for a separate non-curricular
          timetable with its own date range. Mon–Fri run 8 periods, Saturday 5. Download
          class-wise or teacher-wise PDFs.
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
          {/* Class + section picker — client-side so sections show instantly. */}
          <TimetablePicker
            classes={classOptions.map((c) => ({ id: c.id, display_name: c.display_name }))}
            sectionsByClass={sectionsByClass}
            initialClassId={classId}
            initialSection={section}
          />

          {selectedClass ? (
            <TimetableBuilder
              // Remount on any class/section change so the grid state is
              // re-seeded from that section's saved slots. Without this key React
              // keeps the mounted builder and its useState-seeded cells persist,
              // so switching from A to B shows (and could re-save) A's grid.
              key={`${classId}-${section}`}
              classId={classId}
              section={section}
              className={`${selectedClass.display_name}${section ? ` · ${section}` : ""}`}
              subjects={subjects}
              teachers={teacherList}
              regularSlots={regularSlots}
              remedialSlots={remedialSlots}
              remedialStart={remedialStart}
              remedialEnd={remedialEnd}
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
