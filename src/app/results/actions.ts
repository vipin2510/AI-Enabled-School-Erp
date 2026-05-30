"use server";

import * as XLSX from "xlsx";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  EXAMS,
  examByKey,
  examColumnHeader,
  isExamKey,
  isCoCurricularGrade,
  currentAcademicYear,
} from "@/lib/results";

export type SaveState = { error?: string; ok?: boolean } | undefined;

type MarkRow = {
  student_id: string;
  subject_id: string;
  exam: string;
  academic_year: string;
  marks_obtained: number | null;
  max_marks: number;
  updated_at: string;
  school_id: string;
};

// Parse one "m_<subjectId>_<exam>" field into its parts. Subject ids are UUIDs
// (no underscores), so a 3-way split is unambiguous.
function parseMarkField(name: string): { subjectId: string; exam: string } | null {
  if (!name.startsWith("m_")) return null;
  const parts = name.split("_");
  if (parts.length !== 3) return null;
  const [, subjectId, exam] = parts;
  if (!subjectId || !isExamKey(exam)) return null;
  return { subjectId, exam };
}

// Read + validate a marks value against an exam's maximum.
function readMark(raw: string, max: number): { value: number | null; error?: string } {
  const trimmed = raw.trim();
  if (trimmed === "") return { value: null };
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return { value: null, error: `"${raw}" is not a number` };
  if (n < 0) return { value: null, error: "marks cannot be negative" };
  if (n > max) return { value: null, error: `marks ${n} exceed the maximum of ${max}` };
  return { value: n };
}

// Save every subject × exam mark for a single student.
export async function saveStudentMarks(
  studentId: string,
  classId: string,
  section: string,
  _prev: SaveState,
  formData: FormData
): Promise<SaveState> {
  const profile = await requireDepartment("results");
  const schoolId = await getCurrentSchoolId(profile);
  const academicYear = currentAcademicYear();
  const now = new Date().toISOString();
  const rows: MarkRow[] = [];
  const gradeRows: {
    student_id: string;
    subject_id: string;
    academic_year: string;
    grade: string | null;
    updated_at: string;
    school_id: string;
  }[] = [];

  for (const [name, raw] of formData.entries()) {
    // Scholastic marks: "m_<subjectId>_<exam>".
    const field = parseMarkField(name);
    if (field) {
      const exam = examByKey(field.exam)!;
      const { value, error } = readMark(String(raw), exam.max);
      if (error) return { error: `${exam.label}: ${error}` };
      rows.push({
        student_id: studentId,
        subject_id: field.subjectId,
        exam: field.exam,
        academic_year: academicYear,
        marks_obtained: value,
        max_marks: exam.max,
        updated_at: now,
        school_id: schoolId,
      });
      continue;
    }
    // Co-curricular grade: "g_<subjectId>".
    if (name.startsWith("g_")) {
      const subjectId = name.slice(2);
      const g = String(raw).trim();
      if (g !== "" && !isCoCurricularGrade(g)) return { error: `Invalid grade "${g}".` };
      gradeRows.push({
        student_id: studentId,
        subject_id: subjectId,
        academic_year: academicYear,
        grade: g === "" ? null : g,
        updated_at: now,
        school_id: schoolId,
      });
    }
  }

  const supabase = await createClient();
  if (rows.length) {
    const { error } = await supabase
      .from("marks")
      .upsert(rows, { onConflict: "student_id,subject_id,exam,academic_year" });
    if (error) return { error: error.message };
  }
  if (gradeRows.length) {
    const { error } = await supabase
      .from("co_curricular_grades")
      .upsert(gradeRows, { onConflict: "student_id,subject_id,academic_year" });
    if (error) return { error: error.message };
  }

  revalidatePath(`/results/${classId}/${section}`);
  redirect(`/results/${classId}/${section}?saved=1`);
}

export type ImportState =
  | { error?: string; imported?: number; skipped?: number; subject?: string }
  | undefined;

// Import a filled subject CSV/XLSX: rows keyed by the "Student ID" column,
// columns per exam. Anything unparseable for a row is skipped, not fatal.
export async function importMarksCsv(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const profile = await requireDepartment("results");
  const schoolId = await getCurrentSchoolId(profile);
  const subjectId = String(formData.get("subjectId") ?? "");
  const classId = String(formData.get("classId") ?? "");
  const section = String(formData.get("section") ?? "");
  const file = formData.get("file");

  if (!subjectId) return { error: "Pick a subject before importing." };
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file to import." };

  const supabase = await createClient();
  const { data: subject } = await supabase
    .from("subjects")
    .select("name")
    .eq("school_id", schoolId)
    .eq("id", subjectId)
    .single();

  let sheet: Record<string, unknown>[];
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer" });
    sheet = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
  } catch {
    return { error: "Could not read that file. Re-download the template and try again." };
  }

  const academicYear = currentAcademicYear();
  const now = new Date().toISOString();
  const rows: MarkRow[] = [];
  let skipped = 0;

  // Match each exam column by the prefix of its header label ("Unit Test I …").
  for (const record of sheet) {
    const studentId = String(record["Student ID"] ?? "").trim();
    if (!studentId) {
      skipped++;
      continue;
    }
    for (const exam of EXAMS) {
      const header = examColumnHeader(exam);
      if (!(header in record)) continue;
      const { value, error } = readMark(String(record[header] ?? ""), exam.max);
      if (error) continue; // skip bad cells; keep the rest
      rows.push({
        student_id: studentId,
        subject_id: subjectId,
        exam: exam.key,
        academic_year: academicYear,
        marks_obtained: value,
        max_marks: exam.max,
        updated_at: now,
        school_id: schoolId,
      });
    }
  }

  if (rows.length) {
    const { error } = await supabase
      .from("marks")
      .upsert(rows, { onConflict: "student_id,subject_id,exam,academic_year" });
    if (error) return { error: error.message };
  }

  revalidatePath(`/results/${classId}/${section}`);
  return {
    imported: rows.length,
    skipped,
    subject: subject?.name ?? "subject",
  };
}
