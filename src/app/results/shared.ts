import { createClient } from "@/lib/supabase/server";
import { markKey, type MarksMap } from "@/lib/results";

export type StudentRow = {
  id: string;
  full_name: string;
  admission_no: string | null;
  father_name: string | null;
};

export type SubjectRow = { id: string; name: string };

// Class + section header info plus the subjects offered and the students
// enrolled (active, in that section), ready for the marks workspace.
// Subjects are split: scholastic ones get numeric marks; co-curricular ones
// get a single A–E grade.
export async function loadClassSection(classId: string, section: string, schoolId: string) {
  const supabase = await createClient();
  const [{ data: klass }, { data: subjectRows }, { data: students }] = await Promise.all([
    supabase.from("classes").select("id, display_name").eq("school_id", schoolId).eq("id", classId).single(),
    supabase.from("subjects").select("id, name, category").eq("school_id", schoolId).eq("class_id", classId).order("name"),
    supabase
      .from("students")
      .select("id, full_name, admission_no, father_name")
      .eq("school_id", schoolId)
      .eq("class_id", classId)
      .eq("section", section)
      .neq("status", "alumni")
      .order("full_name"),
  ]);

  const all = (subjectRows ?? []) as (SubjectRow & { category: string })[];
  return {
    klass: (klass ?? null) as { id: string; display_name: string } | null,
    subjects: all.filter((s) => s.category !== "co_curricular").map(({ id, name }) => ({ id, name })),
    coCurricular: all
      .filter((s) => s.category === "co_curricular")
      .map(({ id, name }) => ({ id, name })),
    students: (students ?? []) as StudentRow[],
  };
}

// Co-curricular grades for a set of students in one year, as
// student_id → { subject_id → grade }.
export async function loadGradesByStudent(
  studentIds: string[],
  academicYear: string,
  schoolId: string
): Promise<Record<string, Record<string, string>>> {
  const result: Record<string, Record<string, string>> = {};
  if (studentIds.length === 0) return result;

  const supabase = await createClient();
  const { data } = await supabase
    .from("co_curricular_grades")
    .select("student_id, subject_id, grade")
    .eq("school_id", schoolId)
    .in("student_id", studentIds)
    .eq("academic_year", academicYear);

  for (const row of (data ?? []) as {
    student_id: string;
    subject_id: string;
    grade: string | null;
  }[]) {
    if (row.grade) (result[row.student_id] ??= {})[row.subject_id] = row.grade;
  }
  return result;
}

// All marks for a set of students in one academic year, as a per-student map
// keyed "subjectId:exam".
export async function loadMarksByStudent(
  studentIds: string[],
  academicYear: string,
  schoolId: string
): Promise<Record<string, MarksMap>> {
  const result: Record<string, MarksMap> = {};
  if (studentIds.length === 0) return result;

  const supabase = await createClient();
  const { data } = await supabase
    .from("marks")
    .select("student_id, subject_id, exam, marks_obtained")
    .eq("school_id", schoolId)
    .in("student_id", studentIds)
    .eq("academic_year", academicYear);

  for (const row of (data ?? []) as {
    student_id: string;
    subject_id: string;
    exam: string;
    marks_obtained: number | null;
  }[]) {
    (result[row.student_id] ??= {})[markKey(row.subject_id, row.exam)] =
      row.marks_obtained;
  }
  return result;
}
