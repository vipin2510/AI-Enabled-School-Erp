import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import path from "node:path";
import fs from "node:fs/promises";
import { createClient } from "@/lib/supabase/server";
import { requireRole, getCurrentSchoolId } from "@/lib/auth";
import {
  currentAcademicYear,
  computeResult,
  examsForTerm,
} from "@/lib/results";
import {
  loadClassSection,
  loadMarksByStudent,
  loadGradesByStudent,
} from "@/app/results/shared";
import { ResultCardFromTemplate } from "@/components/result-card-from-template";
import { buildTemplateData } from "@/app/results/template-renderer";
import type { Layout, PageSize } from "@/lib/result-template";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/results/templates/[id]/preview
// Renders the template with the first available student's real data so
// admin/manager can sanity-check what the saved layout looks like.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await requireRole("admin", "manager");
  const schoolId = await getCurrentSchoolId(profile);
  const { id } = await params;

  const supabase = await createClient();
  const { data: template, error } = await supabase
    .from("result_templates")
    .select("layout, page_size, name")
    .eq("id", id)
    .maybeSingle();
  if (error || !template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
  const layout = (template.layout ?? []) as Layout;
  const pageSize = template.page_size as PageSize;

  // Pick any class/section/student from this school for the preview.
  const { data: anyStudent } = await supabase
    .from("students")
    .select("id, class_id, section, classes(display_name)")
    .eq("school_id", schoolId)
    .eq("status", "active")
    .not("class_id", "is", null)
    .not("section", "is", null)
    .limit(1)
    .maybeSingle();

  const logoPath = path.join(process.cwd(), "public", "letterhead", "aps-logo.jpeg");
  const logoDataUrl = `data:image/jpeg;base64,${(await fs.readFile(logoPath)).toString("base64")}`;

  // If the school has no class/section/students yet, we still want the
  // preview to work — feed canned data so the editor experience doesn't
  // dead-end while the office is still setting things up.
  let data;
  if (anyStudent && anyStudent.class_id && anyStudent.section) {
    const { klass, subjects, coCurricular, students } = await loadClassSection(
      anyStudent.class_id,
      anyStudent.section,
      schoolId
    );
    const me = students.find((s) => s.id === anyStudent.id) ?? students[0];
    const academicYear = currentAcademicYear();
    const exams = examsForTerm(null);
    const marksByStudent = me
      ? await loadMarksByStudent([me.id], academicYear, schoolId)
      : {};
    const gradesByStudent = me
      ? await loadGradesByStudent([me.id], academicYear, schoolId)
      : {};
    if (me && klass) {
      const grades = gradesByStudent[me.id] ?? {};
      data = buildTemplateData({
        schoolId,
        logoDataUrl,
        student: {
          full_name: me.full_name,
          admission_no: me.admission_no,
          father_name: me.father_name,
          mother_name: null,
        },
        className: klass.display_name,
        section: anyStudent.section,
        academicYear,
        termLabel: "Preview",
        exams,
        subjects,
        marks: marksByStudent[me.id] ?? {},
        coCurricular: coCurricular.map((c) => ({
          name: c.name,
          grade: grades[c.id] ?? null,
        })),
      });
    }
  }

  if (!data) {
    // Canned preview data — used when the school has no students yet.
    const exams = examsForTerm(null);
    const result = computeResult(
      [{ id: "s1", name: "English" }],
      {},
      exams
    );
    data = buildTemplateData({
      schoolId,
      logoDataUrl,
      student: {
        full_name: "Sample Student",
        admission_no: "—",
        father_name: "—",
        mother_name: "—",
      },
      className: "Class",
      section: "—",
      academicYear: currentAcademicYear(),
      termLabel: "Preview",
      exams,
      subjects: [{ id: "s1", name: "English" }],
      marks: {},
      coCurricular: [],
    });
    void result;
  }

  const buf = await renderToBuffer(
    ResultCardFromTemplate({ layout, data, pageSize }) as never
  );

  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="template-${template.name.replace(/[^a-z0-9]+/gi, "-")}-preview.pdf"`,
    },
  });
}
