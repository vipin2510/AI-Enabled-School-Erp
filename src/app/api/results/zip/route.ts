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

// Upper bound on result cards rendered into one ZIP per invocation. Comfortably
// above any real section; guards against a runaway synchronous render batch.
const MAX_BATCH = 120;

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

  const renderCard = (s: (typeof students)[number]) => {
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
    return renderToBuffer(ResultCardPdf({ data }) as never);
  };

  // Single-student mode: render ONLY that student's card. Previously this
  // rendered every card in the section just to return one — a huge, needless
  // CPU cost on the (common) per-student Preview/Download path.
  if (singleStudentId) {
    const student = students.find((s) => s.id === singleStudentId);
    if (!student) {
      return NextResponse.json({ error: "Student not in this section" }, { status: 404 });
    }
    const buf = await renderCard(student);
    const filename = `result-${safe(student.full_name)}-${academicYear}.pdf`;
    return new NextResponse(buf as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  }

  // Guardrail: the whole section renders synchronously in one invocation
  // (@react-pdf is CPU-bound). A real section is well under this; a larger
  // request would burn a huge amount of function CPU in a single call.
  if (students.length > MAX_BATCH) {
    return NextResponse.json(
      { error: `Too many students (${students.length}) for one batch. Max ${MAX_BATCH}.` },
      { status: 413 }
    );
  }

  // Whole-section mode: render each card (sequential — @react-pdf is CPU-bound
  // on Node's single thread, so parallelising would only raise peak memory).
  const entries: ZipEntry[] = [];
  const used = new Set<string>();
  for (const s of students) {
    const buf = await renderCard(s);
    // Keep filenames unique (two students can share a name).
    let name = `${safe(s.admission_no || s.full_name)}.pdf`;
    let n = 2;
    while (used.has(name)) name = `${safe(s.admission_no || s.full_name)}-${n++}.pdf`;
    used.add(name);
    entries.push({ name, data: new Uint8Array(buf) });
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
