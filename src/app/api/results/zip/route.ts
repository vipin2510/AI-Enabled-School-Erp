import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import { currentAcademicYear, computeResult } from "@/lib/results";
import {
  loadClassSection,
  loadMarksByStudent,
  loadExtrasByStudent,
} from "@/app/results/shared";
import { buildMarksheet } from "@/app/results/marksheet";
import { ResultCardPdf } from "@/components/result-card-pdf";
import { createZip, type ZipEntry } from "@/lib/zip";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/results/zip?classId=&section=                  → ZIP of every student
// GET /api/results/zip?classId=&section=&studentId=...    → single inline PDF
// Single-student mode is used by the per-student result page's
// Preview / Download buttons so a teacher can check a card before
// printing the full batch.
export async function GET(req: Request) {
  const profile = await requireDepartment("results");
  const schoolId = await getCurrentSchoolId(profile);
  const url = new URL(req.url);
  const classId = url.searchParams.get("classId") ?? "";
  const section = url.searchParams.get("section") ?? "";
  const singleStudentId = url.searchParams.get("studentId");
  if (!classId || !section) {
    return NextResponse.json({ error: "Missing classId or section" }, { status: 400 });
  }

  const { klass, subjects, students } = await loadClassSection(classId, section, schoolId);
  if (!klass) return NextResponse.json({ error: "Class not found" }, { status: 404 });
  if (students.length === 0) {
    return NextResponse.json({ error: "No students in this section" }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: school } = await supabase
    .from("schools")
    .select("name, location")
    .eq("id", schoolId)
    .maybeSingle();
  const schoolName = school
    ? `${school.name}, ${String(school.location).split(",")[0]}`.toUpperCase()
    : "ADESHWAR PUBLIC SCHOOL";

  const academicYear = currentAcademicYear();
  const studentIds = students.map((s) => s.id);
  const marksByStudent = await loadMarksByStudent(studentIds, academicYear, schoolId);
  const extrasByStudent = await loadExtrasByStudent(studentIds, academicYear, schoolId);

  // Class ranking + highest aggregate, computed once over everyone.
  const percentById = new Map(
    students.map((s) => [s.id, computeResult(subjects, marksByStudent[s.id] ?? {}).percent])
  );
  const ranked = [...students].sort(
    (a, b) => (percentById.get(b.id) ?? 0) - (percentById.get(a.id) ?? 0)
  );
  const rankById = new Map(ranked.map((s, i) => [s.id, i + 1]));
  const highestPercent = ranked.length ? (percentById.get(ranked[0].id) ?? 0) : 0;

  const safe = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  const entries: ZipEntry[] = [];
  const used = new Set<string>();

  for (const s of students) {
    const data = buildMarksheet({
      schoolName,
      academicYear,
      className: klass.display_name,
      section,
      studentName: s.full_name,
      subjects,
      marks: marksByStudent[s.id] ?? {},
      extras: extrasByStudent[s.id] ?? {},
      rank: rankById.get(s.id) ?? null,
      highestPercent,
    });
    const buf = await renderToBuffer(ResultCardPdf({ data }) as never);

    // Keep filenames unique (two students can share a name).
    let name = `${safe(s.admission_no || s.full_name)}.pdf`;
    let n = 2;
    while (used.has(name)) name = `${safe(s.admission_no || s.full_name)}-${n++}.pdf`;
    used.add(name);
    entries.push({ name, data: new Uint8Array(buf) });
  }

  // Single-student mode: pick the rendered entry and return as inline PDF.
  if (singleStudentId) {
    const idx = students.findIndex((s) => s.id === singleStudentId);
    if (idx === -1) {
      return NextResponse.json({ error: "Student not in this section" }, { status: 404 });
    }
    const entry = entries[idx];
    const filename = `result-${safe(students[idx].full_name)}-${academicYear}.pdf`;
    return new NextResponse(entry.data as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  }

  const zip = createZip(entries);
  const filename = `result-cards-${safe(klass.display_name)}-${safe(section)}-${academicYear}.zip`;
  return new NextResponse(zip as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
