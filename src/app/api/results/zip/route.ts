import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import path from "node:path";
import fs from "node:fs/promises";
import { createClient } from "@/lib/supabase/server";
import { requireDepartment } from "@/lib/auth";
import { currentAcademicYear, computeResult, examsForTerm } from "@/lib/results";
import { loadClassSection, loadMarksByStudent, loadGradesByStudent } from "@/app/results/shared";
import { ResultCardPdf } from "@/components/result-card-pdf";
import { createZip, type ZipEntry } from "@/lib/zip";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/results/zip?classId=&section=
// Renders one report-card PDF per student in the class-section and bundles them
// into a ZIP for download.
export async function GET(req: Request) {
  await requireDepartment("results");
  const url = new URL(req.url);
  const classId = url.searchParams.get("classId") ?? "";
  const section = url.searchParams.get("section") ?? "";
  const term = url.searchParams.get("term"); // "1" → Term 1 only; else overall
  if (!classId || !section) {
    return NextResponse.json({ error: "Missing classId or section" }, { status: 400 });
  }
  const exams = examsForTerm(term);
  const termLabel = term === "1" ? "Term 1" : undefined;

  const { klass, subjects, coCurricular, students } = await loadClassSection(classId, section);
  if (!klass) return NextResponse.json({ error: "Class not found" }, { status: 404 });
  if (students.length === 0) {
    return NextResponse.json({ error: "No students in this section" }, { status: 404 });
  }

  // Mother's name isn't in the base loader; fetch it for the card header.
  const supabase = await createClient();
  const { data: extra } = await supabase
    .from("students")
    .select("id, mother_name")
    .in("id", students.map((s) => s.id));
  const motherById = new Map(
    (extra ?? []).map((r: { id: string; mother_name: string | null }) => [r.id, r.mother_name])
  );

  const academicYear = currentAcademicYear();
  const studentIds = students.map((s) => s.id);
  const marksByStudent = await loadMarksByStudent(studentIds, academicYear);
  const gradesByStudent = await loadGradesByStudent(studentIds, academicYear);

  const logoPath = path.join(process.cwd(), "public", "letterhead", "aps-logo.jpeg");
  const logoDataUrl = `data:image/jpeg;base64,${(await fs.readFile(logoPath)).toString("base64")}`;

  const safe = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  const entries: ZipEntry[] = [];
  const used = new Set<string>();

  for (const s of students) {
    const result = computeResult(subjects, marksByStudent[s.id] ?? {}, exams);
    const grades = gradesByStudent[s.id] ?? {};
    const buf = await renderToBuffer(
      ResultCardPdf({
        data: {
          student: {
            full_name: s.full_name,
            admission_no: s.admission_no,
            father_name: s.father_name,
            mother_name: motherById.get(s.id) ?? null,
          },
          className: klass.display_name,
          section,
          academicYear,
          exams,
          termLabel,
          subjects: result.subjects,
          coCurricular: coCurricular.map((c) => ({ name: c.name, grade: grades[c.id] ?? null })),
          total: result.total,
          max: result.max,
          percent: result.percent,
        },
        logoDataUrl,
      }) as never
    );

    // Keep filenames unique (two students can share a name).
    let name = `${safe(s.admission_no || s.full_name)}.pdf`;
    let n = 2;
    while (used.has(name)) name = `${safe(s.admission_no || s.full_name)}-${n++}.pdf`;
    used.add(name);
    entries.push({ name, data: new Uint8Array(buf) });
  }

  const zip = createZip(entries);
  const termPart = term === "1" ? "term1-" : "";
  const filename = `result-cards-${termPart}${safe(klass.display_name)}-${safe(section)}-${academicYear}.zip`;

  return new NextResponse(zip as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
