import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import path from "node:path";
import fs from "node:fs/promises";
import { createClient } from "@/lib/supabase/server";
import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import { currentAcademicYear, computeResult, examsForTerm } from "@/lib/results";
import { loadClassSection, loadMarksByStudent, loadGradesByStudent } from "@/app/results/shared";
import { ResultCardPdf } from "@/components/result-card-pdf";
import { ResultCardFromTemplate } from "@/components/result-card-from-template";
import { buildTemplateData, chooseTemplate } from "@/app/results/template-renderer";
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
  const term = url.searchParams.get("term"); // "1" → Term 1 only; else overall
  const singleStudentId = url.searchParams.get("studentId");
  const paramTemplateId = url.searchParams.get("templateId");
  if (!classId || !section) {
    return NextResponse.json({ error: "Missing classId or section" }, { status: 400 });
  }
  const exams = examsForTerm(term);
  const termLabel = term === "1" ? "Term 1" : undefined;

  const { klass, subjects, coCurricular, students } = await loadClassSection(classId, section, schoolId);
  if (!klass) return NextResponse.json({ error: "Class not found" }, { status: 404 });
  if (students.length === 0) {
    return NextResponse.json({ error: "No students in this section" }, { status: 404 });
  }

  // Mother's name isn't in the base loader; fetch it for the card header.
  const supabase = await createClient();
  const { data: extra } = await supabase
    .from("students")
    .select("id, mother_name")
    .eq("school_id", schoolId)
    .in("id", students.map((s) => s.id));
  const motherById = new Map(
    (extra ?? []).map((r: { id: string; mother_name: string | null }) => [r.id, r.mother_name])
  );

  const academicYear = currentAcademicYear();
  const studentIds = students.map((s) => s.id);
  const marksByStudent = await loadMarksByStudent(studentIds, academicYear, schoolId);
  const gradesByStudent = await loadGradesByStudent(studentIds, academicYear, schoolId);

  const logoPath = path.join(process.cwd(), "public", "letterhead", "aps-logo.jpeg");
  const logoDataUrl = `data:image/jpeg;base64,${(await fs.readFile(logoPath)).toString("base64")}`;

  // Pick the active template once for the whole batch. If no editable
  // template is configured (or the layout is empty), `template` is null
  // and we render with the legacy hardcoded ResultCardPdf.
  const template = await chooseTemplate(paramTemplateId);

  const safe = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  const entries: ZipEntry[] = [];
  const used = new Set<string>();

  for (const s of students) {
    const result = computeResult(subjects, marksByStudent[s.id] ?? {}, exams);
    const grades = gradesByStudent[s.id] ?? {};
    const coCurricularGrades = coCurricular.map((c) => ({
      name: c.name,
      grade: grades[c.id] ?? null,
    }));
    let buf: Buffer;
    if (template) {
      const data = buildTemplateData({
        schoolId,
        logoDataUrl,
        student: {
          full_name: s.full_name,
          admission_no: s.admission_no,
          father_name: s.father_name,
          mother_name: motherById.get(s.id) ?? null,
        },
        className: klass.display_name,
        section,
        academicYear,
        termLabel: termLabel ?? "",
        exams,
        subjects,
        marks: marksByStudent[s.id] ?? {},
        coCurricular: coCurricularGrades,
      });
      buf = await renderToBuffer(
        ResultCardFromTemplate({
          layout: template.layout,
          data,
          pageSize: template.page_size,
        }) as never
      );
    } else {
      buf = await renderToBuffer(
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
            coCurricular: coCurricularGrades,
            total: result.total,
            max: result.max,
            percent: result.percent,
          },
          logoDataUrl,
        }) as never
      );
    }

    // Keep filenames unique (two students can share a name).
    let name = `${safe(s.admission_no || s.full_name)}.pdf`;
    let n = 2;
    while (used.has(name)) name = `${safe(s.admission_no || s.full_name)}-${n++}.pdf`;
    used.add(name);
    entries.push({ name, data: new Uint8Array(buf) });
  }

  // Single-student mode: pick the rendered entry and return as inline PDF.
  if (singleStudentId) {
    const student = students.find((s) => s.id === singleStudentId);
    if (!student) {
      return NextResponse.json({ error: "Student not in this section" }, { status: 404 });
    }
    const idx = students.indexOf(student);
    const entry = entries[idx];
    if (!entry) {
      return NextResponse.json({ error: "Failed to render result card" }, { status: 500 });
    }
    const termPart = term === "1" ? "term1-" : "";
    const filename = `result-${termPart}${safe(student.full_name)}-${academicYear}.pdf`;
    return new NextResponse(entry.data as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
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
