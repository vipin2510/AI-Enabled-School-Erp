// Adapter between the existing result-rendering pipeline and the JSON
// template renderer. Two responsibilities:
//   • Pick the right template (explicit ?templateId=… or the active default).
//   • Map a single student's marks + the school's identity into the
//     TemplateData shape the renderer expects.

import { findSchool } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import {
  computeResult,
  gradeFor,
  type Exam,
  type MarksMap,
  type SubjectResult,
} from "@/lib/results";
import type {
  Layout,
  PageSize,
  TemplateData,
} from "@/lib/result-template";

export type ChosenTemplate = {
  id: string;
  layout: Layout;
  page_size: PageSize;
};

// Returns null when no editable template is configured — caller should
// fall back to the hardcoded ResultCardPdf in that case.
export async function chooseTemplate(
  paramTemplateId: string | null
): Promise<ChosenTemplate | null> {
  const supabase = await createClient();
  if (paramTemplateId) {
    const { data } = await supabase
      .from("result_templates")
      .select("id, layout, page_size")
      .eq("id", paramTemplateId)
      .maybeSingle();
    if (data && Array.isArray(data.layout) && data.layout.length > 0) {
      return data as ChosenTemplate;
    }
  }
  const { data } = await supabase
    .from("result_templates")
    .select("id, layout, page_size")
    .eq("is_default", true)
    .maybeSingle();
  if (data && Array.isArray(data.layout) && data.layout.length > 0) {
    return data as ChosenTemplate;
  }
  return null;
}

type StudentInfo = {
  full_name: string;
  admission_no: string | null;
  father_name: string | null;
  mother_name: string | null;
  date_of_birth?: string | null;
  contact_number?: string | null;
};

// Build the TemplateData blob for a single student.
export function buildTemplateData({
  schoolId,
  logoDataUrl,
  student,
  className,
  section,
  academicYear,
  termLabel,
  exams,
  subjects,
  marks,
  coCurricular,
}: {
  schoolId: string;
  logoDataUrl: string;
  student: StudentInfo;
  className: string;
  section: string;
  academicYear: string;
  termLabel: string;
  exams: Exam[];
  subjects: { id: string; name: string }[];
  marks: MarksMap;
  coCurricular: { name: string; grade: string | null }[];
}): TemplateData {
  const result = computeResult(subjects, marks, exams);
  const meta = findSchool(schoolId);

  // Pre-bake the per-cell grid so the renderer doesn't need to recompute
  // anything per template column.
  const subjectsGrid = result.subjects.map((sr) =>
    cellsForSubject(sr, exams, result.total, result.max, result.percent)
  );

  return {
    school: {
      name: meta?.name ?? "School",
      city: meta?.location?.split(",")[0] ?? "",
      code: meta?.boardCode ?? "",
      affiliation: meta?.board ? `Affiliated to ${meta.board}` : "",
      address: meta?.addressLine ?? meta?.location ?? "",
      mobile: meta?.mobile ?? "",
      email: meta?.email ?? "",
      logoDataUrl,
    },
    session: { academic_year: academicYear, term_label: termLabel },
    student: {
      full_name: student.full_name,
      admission_no: student.admission_no ?? "",
      class: className,
      section,
      father_name: student.father_name ?? "",
      mother_name: student.mother_name ?? "",
      dob: student.date_of_birth ?? "",
      contact_number: student.contact_number ?? "",
    },
    result: {
      total: result.total,
      max: result.max,
      percent: result.percent,
      grade: gradeFor(result.percent),
      status: result.total >= Math.ceil(result.max * 0.33) ? "PASS" : "FAIL",
    },
    marksGrid: {
      subjects: subjectsGrid,
      coCurricular,
    },
  };
}

function cellsForSubject(
  sr: SubjectResult,
  exams: Exam[],
  grandTotal: number,
  grandMax: number,
  grandPercent: number
) {
  const cells: Record<string, number | string> = {};
  for (const exam of exams) {
    const got = sr.obtained[exam.key];
    cells[`${exam.key}:exam.max`] = exam.max;
    cells[`${exam.key}:exam.marks`] = got ?? "—";
    if (typeof got === "number") {
      const percent = (got / exam.max) * 100;
      cells[`${exam.key}:exam.grade`] = gradeFor(percent);
    } else {
      cells[`${exam.key}:exam.grade`] = "—";
    }
  }
  cells["__total__:total.marks"] = sr.total;
  cells["__total__:total.max"] = sr.max;
  cells["__total__:total.percent"] = `${sr.percent.toFixed(2)}%`;
  cells["__total__:total.grade"] = gradeFor(sr.percent);
  // Grand totals available under the same keys for footer-style summary rows.
  cells["grand:total.marks"] = grandTotal;
  cells["grand:total.max"] = grandMax;
  cells["grand:total.percent"] = `${grandPercent.toFixed(2)}%`;
  cells["grand:total.grade"] = gradeFor(grandPercent);
  return {
    name: sr.name,
    cells,
  };
}
