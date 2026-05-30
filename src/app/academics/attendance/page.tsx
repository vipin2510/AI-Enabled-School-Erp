import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isSunday, prettyDate, todayStr } from "@/lib/attendance";
import AttendancePicker from "./picker";
import AttendanceForm from "./attendance-form";

export const dynamic = "force-dynamic";

type SectionRow = { class_id: string; name: string };

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ class_id?: string; section?: string; date?: string }>;
}) {
  const profile = await requireDepartment("academics");
  const schoolId = await getCurrentSchoolId(profile);
  const { class_id, section, date: rawDate } = await searchParams;
  const date = rawDate || todayStr();
  const supabase = await createClient();

  const [{ data: classes }, { data: sections }] = await Promise.all([
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
  ]);

  const sectionsByClass: Record<string, string[]> = {};
  for (const s of (sections ?? []) as SectionRow[]) {
    (sectionsByClass[s.class_id] ??= []).push(s.name);
  }

  const selected = Boolean(class_id && section);
  let students: { id: string; full_name: string; admission_no: string | null }[] = [];
  const initial: Record<string, "present" | "absent"> = {};
  let className = "";

  if (selected) {
    const [{ data: studs }, { data: klass }, { data: marks }] = await Promise.all([
      supabase
        .from("students")
        .select("id, full_name, admission_no")
        .eq("school_id", schoolId)
        .eq("class_id", class_id!)
        .eq("section", section!)
        .neq("status", "alumni")
        .order("full_name"),
      supabase
        .from("classes")
        .select("display_name")
        .eq("school_id", schoolId)
        .eq("id", class_id!)
        .single(),
      supabase
        .from("attendance")
        .select("student_id, status")
        .eq("school_id", schoolId)
        .eq("class_id", class_id!)
        .eq("section", section!)
        .eq("date", date),
    ]);
    students = (studs ?? []) as typeof students;
    className = klass?.display_name ?? "";
    for (const m of (marks ?? []) as { student_id: string; status: "present" | "absent" }[]) {
      initial[m.student_id] = m.status;
    }
  }

  const sunday = isSunday(date);
  const alreadyMarked = Object.keys(initial).length > 0;

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Attendance</h1>
        <p className="mt-1 text-sm text-stone-500">
          Mark daily present/absent for a class. One submission per day; Sundays and
          holidays are simply left unmarked.
        </p>
      </header>

      <AttendancePicker
        classes={(classes ?? []) as { id: string; display_name: string }[]}
        sectionsByClass={sectionsByClass}
        initialClassId={class_id ?? ""}
        initialSection={section ?? ""}
        initialDate={date}
      />

      {selected && (
        <div className="mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-stone-800">
              {className} · Section {section} · {prettyDate(date)}
            </h2>
            {alreadyMarked && !sunday && (
              <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600">
                Already marked — edit &amp; resubmit to update
              </span>
            )}
          </div>

          {sunday ? (
            <div className="card p-6 text-sm text-stone-600">
              {prettyDate(date)} is a Sunday — attendance isn’t taken. Pick another date.
            </div>
          ) : students.length === 0 ? (
            <div className="card p-6 text-sm text-stone-600">No students in this section.</div>
          ) : (
            <AttendanceForm
              classId={class_id!}
              section={section!}
              date={date}
              students={students}
              initial={initial}
            />
          )}
        </div>
      )}
    </div>
  );
}
