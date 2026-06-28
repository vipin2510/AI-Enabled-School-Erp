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
  isExtraField,
  extraByKey,
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

// Parse one "x_<field>_<exam>" extras field. Field keys contain underscores
// (e.g. "eng_dictation") and exam keys never do, so the exam is the segment
// after the last underscore and the field is everything before it.
function parseExtraFieldName(name: string): { field: string; exam: string } | null {
  if (!name.startsWith("x_")) return null;
  const rest = name.slice(2);
  const i = rest.lastIndexOf("_");
  if (i < 0) return null;
  const field = rest.slice(0, i);
  const exam = rest.slice(i + 1);
  if (!isExtraField(field) || !isExamKey(exam)) return null;
  return { field, exam };
}

type ExtraRow = {
  student_id: string;
  school_id: string;
  academic_year: string;
  exam: string;
  field: string;
  value: string | null;
  updated_at: string;
};

// Read + validate an extras value by its field kind. Stored as text.
function readExtra(raw: string, field: ReturnType<typeof extraByKey>): { value: string | null; error?: string } {
  const t = raw.trim();
  if (t === "" || !field) return { value: t === "" ? null : t };
  if (field.kind === "grade") {
    if (!isCoCurricularGrade(t)) return { value: null, error: `${field.label}: invalid grade "${t}"` };
    return { value: t };
  }
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return { value: null, error: `${field.label}: "${raw}" is not valid` };
  if (field.kind === "marks" && field.max != null && n > field.max) {
    return { value: null, error: `${field.label}: ${n} exceeds the maximum of ${field.max}` };
  }
  return { value: t };
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

  // Verify the student belongs to the caller's school. RLS is permissive, so
  // without this any results-dept session could write marks for any student
  // UUID it happens to know.
  const supabaseEarly = await createClient();
  const { data: ownsStudent } = await supabaseEarly
    .from("students")
    .select("id")
    .eq("school_id", schoolId)
    .eq("id", studentId)
    .maybeSingle();
  if (!ownsStudent) return { error: "Student not found in this school." };
  const gradeRows: {
    student_id: string;
    subject_id: string;
    academic_year: string;
    grade: string | null;
    updated_at: string;
    school_id: string;
  }[] = [];
  const extraRows: ExtraRow[] = [];

  for (const [name, raw] of formData.entries()) {
    // Extra assessment: "x_<field>_<exam>".
    const extra = parseExtraFieldName(name);
    if (extra) {
      const field = extraByKey(extra.field);
      const { value, error } = readExtra(String(raw), field);
      if (error) return { error };
      extraRows.push({
        student_id: studentId,
        school_id: schoolId,
        academic_year: academicYear,
        exam: extra.exam,
        field: extra.field,
        value,
        updated_at: now,
      });
      continue;
    }
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

  const supabase = supabaseEarly;
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
  if (extraRows.length) {
    const { error } = await supabase
      .from("report_extras")
      .upsert(extraRows, { onConflict: "student_id,academic_year,exam,field" });
    // Tolerate the table not being migrated yet — marks/grades still saved.
    if (error && !/relation .*report_extras|does not exist/.test(error.message)) {
      return { error: error.message };
    }
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
  // Verify subject belongs to this school — `.single()` errors if not, which
  // would crash the action. Use maybeSingle and check.
  const { data: subject } = await supabase
    .from("subjects")
    .select("name")
    .eq("school_id", schoolId)
    .eq("id", subjectId)
    .maybeSingle();
  if (!subject) return { error: "Subject not found in this school." };

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
  const claimedIds = new Set<string>();
  for (const record of sheet) {
    const sid = String(record["Student ID"] ?? "").trim();
    if (sid) claimedIds.add(sid);
  }

  // Pull every student id from the CSV that's in THIS school. Any id missing
  // from this set (cross-school injection or a typo'd UUID) is skipped — we
  // never write marks for it.
  let allowedIds = new Set<string>();
  if (claimedIds.size) {
    const { data: owned, error: ownedErr } = await supabase
      .from("students")
      .select("id")
      .eq("school_id", schoolId)
      .in("id", Array.from(claimedIds));
    if (ownedErr) return { error: ownedErr.message };
    allowedIds = new Set((owned ?? []).map((r) => r.id));
  }

  for (const record of sheet) {
    const studentId = String(record["Student ID"] ?? "").trim();
    if (!studentId || !allowedIds.has(studentId)) {
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
