import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { currentAcademicYear, markKey, type MarksMap } from "@/lib/results";
import { saveStudentMarks } from "@/app/results/actions";
import StudentMarksForm from "./marks-form";
import { DownloadButton } from "@/components/ui/download-button";
import { PreviewButton } from "@/components/ui/preview-button";

export const dynamic = "force-dynamic";

export default async function StudentMarksPage({
  params,
}: {
  params: Promise<{ classId: string; section: string; studentId: string }>;
}) {
  const profile = await requireDepartment("results");
  const schoolId = await getCurrentSchoolId(profile);
  const { classId, section: rawSection, studentId } = await params;
  const section = decodeURIComponent(rawSection);
  const supabase = await createClient();

  const academicYear = currentAcademicYear();

  const [{ data: student }, { data: subjectRows }, { data: klass }, { data: marks }, { data: grades }] =
    await Promise.all([
      supabase
        .from("students")
        .select("id, full_name, admission_no, father_name")
        .eq("school_id", schoolId)
        .eq("id", studentId)
        .single(),
      supabase.from("subjects").select("id, name, category").eq("school_id", schoolId).eq("class_id", classId).order("name"),
      supabase.from("classes").select("display_name").eq("school_id", schoolId).eq("id", classId).single(),
      supabase
        .from("marks")
        .select("subject_id, exam, marks_obtained")
        .eq("school_id", schoolId)
        .eq("student_id", studentId)
        .eq("academic_year", academicYear),
      supabase
        .from("co_curricular_grades")
        .select("subject_id, grade")
        .eq("school_id", schoolId)
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
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={backHref} className="text-sm text-stone-500 hover:underline">
            ← {klass?.display_name ?? "Class"} · Section {section}
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{student.full_name}</h1>
          <p className="mt-1 text-sm text-stone-500">
            {student.admission_no ? `Adm. ${student.admission_no} · ` : ""}
            {student.father_name ? `Father: ${student.father_name} · ` : ""}
            Academic Year {academicYear}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PreviewButton
            url={`/api/results/zip?classId=${classId}&section=${encodeURIComponent(section)}&studentId=${studentId}`}
            className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            👁 Preview result card
          </PreviewButton>
          <DownloadButton
            url={`/api/results/zip?classId=${classId}&section=${encodeURIComponent(section)}&studentId=${studentId}`}
            filename={`result-${student.full_name.replace(/[^a-z0-9]+/gi, "-")}.pdf`}
            className="rounded-lg border border-stone-200 bg-stone-100 px-4 py-2 text-sm font-medium text-stone-900 hover:bg-stone-200"
          >
            ⤓ Download
          </DownloadButton>
        </div>
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
