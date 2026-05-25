import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDepartment } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { currentAcademicYear, markKey, type MarksMap } from "@/lib/results";
import { saveStudentMarks } from "@/app/results/actions";
import StudentMarksForm from "./marks-form";

export const dynamic = "force-dynamic";

export default async function StudentMarksPage({
  params,
}: {
  params: Promise<{ classId: string; section: string; studentId: string }>;
}) {
  await requireDepartment("results");
  const { classId, section: rawSection, studentId } = await params;
  const section = decodeURIComponent(rawSection);
  const supabase = await createClient();

  const academicYear = currentAcademicYear();

  const [{ data: student }, { data: subjectRows }, { data: klass }, { data: marks }, { data: grades }] =
    await Promise.all([
      supabase
        .from("students")
        .select("id, full_name, admission_no, father_name")
        .eq("id", studentId)
        .single(),
      supabase.from("subjects").select("id, name, category").eq("class_id", classId).order("name"),
      supabase.from("classes").select("display_name").eq("id", classId).single(),
      supabase
        .from("marks")
        .select("subject_id, exam, marks_obtained")
        .eq("student_id", studentId)
        .eq("academic_year", academicYear),
      supabase
        .from("co_curricular_grades")
        .select("subject_id, grade")
        .eq("student_id", studentId)
        .eq("academic_year", academicYear),
    ]);

  if (!student) notFound();

  const all = (subjectRows ?? []) as { id: string; name: string; category: string }[];
  const subjects = all.filter((s) => s.category !== "co_curricular").map(({ id, name }) => ({ id, name }));
  const coCurricular = all
    .filter((s) => s.category === "co_curricular")
    .map(({ id, name }) => ({ id, name }));

  const marksMap: MarksMap = {};
  for (const m of (marks ?? []) as { subject_id: string; exam: string; marks_obtained: number | null }[]) {
    marksMap[markKey(m.subject_id, m.exam)] = m.marks_obtained;
  }

  const gradeMap: Record<string, string> = {};
  for (const g of (grades ?? []) as { subject_id: string; grade: string | null }[]) {
    if (g.grade) gradeMap[g.subject_id] = g.grade;
  }

  const backHref = `/results/${classId}/${encodeURIComponent(section)}`;
  const action = saveStudentMarks.bind(null, studentId, classId, section);

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <Link href={backHref} className="text-sm text-stone-500 hover:underline">
          ← {klass?.display_name ?? "Class"} · Section {section}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{student.full_name}</h1>
        <p className="mt-1 text-sm text-stone-500">
          {student.admission_no ? `Adm. ${student.admission_no} · ` : ""}
          {student.father_name ? `Father: ${student.father_name} · ` : ""}
          Academic Year {academicYear}
        </p>
      </header>

      {subjects.length === 0 && coCurricular.length === 0 ? (
        <div className="card p-6 text-sm text-stone-600">
          No subjects defined for this class.{" "}
          <Link href="/academics/subjects" className="text-accent hover:underline">
            Add subjects
          </Link>
          .
        </div>
      ) : (
        <StudentMarksForm
          action={action}
          subjects={subjects}
          coCurricular={coCurricular}
          initial={marksMap}
          initialGrades={gradeMap}
          backHref={backHref}
        />
      )}
    </div>
  );
}
