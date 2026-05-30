import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import { EXAMS, examColumnHeader, currentAcademicYear, markKey } from "@/lib/results";
import { loadClassSection, loadMarksByStudent } from "@/app/results/shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// GET /api/results/template?classId=&section=&subjectId=
// A per-subject marks sheet: one row per student, prefilled with any marks
// already entered. Teachers fill the exam columns and re-import it.
export async function GET(req: Request) {
  const profile = await requireDepartment("results");
  const schoolId = await getCurrentSchoolId(profile);
  const url = new URL(req.url);
  const classId = url.searchParams.get("classId") ?? "";
  const section = url.searchParams.get("section") ?? "";
  const subjectId = url.searchParams.get("subjectId") ?? "";
  if (!classId || !section || !subjectId) {
    return NextResponse.json({ error: "Missing classId, section or subjectId" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: subject } = await supabase
    .from("subjects")
    .select("name")
    .eq("school_id", schoolId)
    .eq("id", subjectId)
    .single();
  if (!subject) return NextResponse.json({ error: "Subject not found" }, { status: 404 });

  const { klass, students } = await loadClassSection(classId, section, schoolId);
  const academicYear = currentAcademicYear();
  const marksByStudent = await loadMarksByStudent(
    students.map((s) => s.id),
    academicYear,
    schoolId
  );

  const headers = ["Student ID", "Admission No", "Student Name", ...EXAMS.map(examColumnHeader)];
  const lines = [headers.map(csvCell).join(",")];

  for (const s of students) {
    const marks = marksByStudent[s.id] ?? {};
    const row = [
      s.id,
      s.admission_no ?? "",
      s.full_name,
      ...EXAMS.map((e) => {
        const v = marks[markKey(subjectId, e.key)];
        return v === null || v === undefined ? "" : v;
      }),
    ];
    lines.push(row.map(csvCell).join(","));
  }

  // Prepend a UTF-8 BOM so Excel opens it cleanly.
  const csv = "﻿" + lines.join("\r\n") + "\r\n";
  const safe = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  const filename = `marks-${safe(klass?.display_name ?? "class")}-${safe(section)}-${safe(subject.name)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
