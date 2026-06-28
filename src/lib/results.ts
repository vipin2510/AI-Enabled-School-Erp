// Single source of truth for the Results module's assessment scheme.
// The school runs four Unit Tests (25 marks each) plus three Terminal
// Examinations (100 marks each). Change the EXAMS array here and every screen,
// CSV template, import parser and report card follows automatically.

export type ExamKey = "ut1" | "ut2" | "ut3" | "ut4" | "terminal" | "terminal2" | "terminal3";

export type Exam = {
  key: ExamKey;
  label: string; // full label, e.g. "Unit Test I"
  short: string; // compact label for table headers, e.g. "UT I"
  max: number;
  weight: number; // share of the final percentage (sums to 100 across full scheme)
};

// Final aggregate (matches the school marksheet): Unit Tests together count for
// 20%, Terminal I + II together for 30%, Terminal III for 50%. Spread evenly:
// each UT = 5, each of Terminal I/II = 15, Terminal III = 50 → sums to 100.
export const EXAMS: Exam[] = [
  { key: "ut1", label: "Unit Test I", short: "UT I", max: 25, weight: 5 },
  { key: "ut2", label: "Unit Test II", short: "UT II", max: 25, weight: 5 },
  { key: "ut3", label: "Unit Test III", short: "UT III", max: 25, weight: 5 },
  { key: "ut4", label: "Unit Test IV", short: "UT IV", max: 25, weight: 5 },
  { key: "terminal", label: "Terminal Examination I", short: "Terminal I", max: 100, weight: 15 },
  { key: "terminal2", label: "Terminal Examination II", short: "Terminal II", max: 100, weight: 15 },
  { key: "terminal3", label: "Terminal Examination III", short: "Terminal III", max: 100, weight: 50 },
];

// The marksheet groups the exams into three column blocks.
export const UT_KEYS: ExamKey[] = ["ut1", "ut2", "ut3", "ut4"];
export const TERMINAL_KEYS: ExamKey[] = ["terminal", "terminal2", "terminal3"];

// Aggregate block weights (the % each block contributes to the final 100).
export const AGGREGATE_WEIGHTS = { ut: 20, termI_II: 30, termIII: 50 } as const;

// Co-curricular subjects are graded once per year, not scored per exam.
export const CO_CURRICULAR_GRADES = ["A", "B", "C", "D", "E"] as const;
export type CoCurricularGrade = (typeof CO_CURRICULAR_GRADES)[number];

export function isCoCurricularGrade(v: string): v is CoCurricularGrade {
  return (CO_CURRICULAR_GRADES as readonly string[]).includes(v);
}

export const EXAM_KEYS = EXAMS.map((e) => e.key);

// Result packs can be downloaded per term. Term 1 covers the first half of the
// session; "overall" is the full scheme.
export const TERM1_EXAM_KEYS: ExamKey[] = ["ut1", "ut2", "terminal"];

export function examsForTerm(term: string | null | undefined): Exam[] {
  if (term === "1") return EXAMS.filter((e) => TERM1_EXAM_KEYS.includes(e.key));
  return EXAMS;
}

export function isExamKey(v: string): v is ExamKey {
  return EXAM_KEYS.includes(v as ExamKey);
}

export function examByKey(key: string): Exam | undefined {
  return EXAMS.find((e) => e.key === key);
}

// Canonical CSV/XLSX column header for an exam. Used to write the template and
// to match columns on import, so the two never drift apart.
export function examColumnHeader(exam: Exam): string {
  return `${exam.label} (max ${exam.max})`;
}

// Total marks across the whole scheme (4×25 + 100 = 200).
export const SCHEME_MAX = EXAMS.reduce((sum, e) => sum + e.max, 0);

// Passing mark for an exam: 33% of its maximum (rounded).
export function passMark(max: number): number {
  return Math.ceil(max * 0.33);
}

// CBSE-style grade bands keyed off a percentage.
export function gradeFor(percent: number): string {
  if (percent >= 91) return "A1";
  if (percent >= 81) return "A2";
  if (percent >= 71) return "B1";
  if (percent >= 61) return "B2";
  if (percent >= 51) return "C1";
  if (percent >= 41) return "C2";
  if (percent >= 33) return "D";
  return "E";
}

// Re-exported so existing results-module callers don't have to change their
// import paths. The canonical definition lives in @/lib/academic-year.
export { currentAcademicYear } from "@/lib/academic-year";

// A marks lookup keyed "subjectId:exam" → obtained marks (number) or null.
export type MarksMap = Record<string, number | null>;

export function markKey(subjectId: string, exam: string): string {
  return `${subjectId}:${exam}`;
}

export type SubjectResult = {
  subjectId: string;
  name: string;
  obtained: Record<ExamKey, number | null>;
  total: number; // sum of entered marks across exams
  max: number; // sum of maxes for exams that have an entered mark
  percent: number;
};

// Compute a student's per-subject and overall result from a marks map.
// Pass `exams` to score only a subset (e.g. a single term); defaults to the
// full scheme. Percentages are weighted by exam (see EXAMS.weight) so partial
// entries reflect their true share of the year rather than averaging only
// what's been entered.
export function computeResult(
  subjects: { id: string; name: string }[],
  marks: MarksMap,
  exams: Exam[] = EXAMS
): { subjects: SubjectResult[]; total: number; max: number; percent: number; grade: string } {
  const schemeWeight = exams.reduce((sum, e) => sum + e.weight, 0);
  let grandTotal = 0;
  let grandMax = 0;
  let grandWeighted = 0;

  const subjectResults: SubjectResult[] = subjects.map((s) => {
    const obtained = {} as Record<ExamKey, number | null>;
    let total = 0;
    let max = 0;
    let weighted = 0;
    for (const exam of exams) {
      const v = marks[markKey(s.id, exam.key)];
      obtained[exam.key] = v ?? null;
      if (v !== null && v !== undefined) {
        total += v;
        max += exam.max;
        weighted += (v / exam.max) * exam.weight;
      }
    }
    grandTotal += total;
    grandMax += max;
    grandWeighted += weighted;
    return {
      subjectId: s.id,
      name: s.name,
      obtained,
      total,
      max,
      percent: schemeWeight ? (weighted / schemeWeight) * 100 : 0,
    };
  });

  const percent = schemeWeight ? (grandWeighted / (schemeWeight * subjects.length || 1)) * 100 : 0;
  return {
    subjects: subjectResults,
    total: grandTotal,
    max: grandMax,
    percent,
    grade: gradeFor(percent),
  };
}

// Per-subject aggregate split for the marksheet's right-hand block: the UT
// total scaled to 20, Terminal I+II to 30, Terminal III to 50, summed to a
// /100 subject aggregate. Treats a missing exam as 0 (matches the school's
// printed sheet, where un-entered exams show 0.00).
export type SubjectAggregate = { ut: number; termI_II: number; termIII: number; total: number };

const UT_MAX = UT_KEYS.reduce((s, k) => s + (examByKey(k)?.max ?? 0), 0); // 100
const TERM_I_II_MAX =
  (examByKey("terminal")?.max ?? 0) + (examByKey("terminal2")?.max ?? 0); // 200
const TERM_III_MAX = examByKey("terminal3")?.max ?? 0; // 100

export function aggregateForSubject(obtained: Record<ExamKey, number | null>): SubjectAggregate {
  const n = (v: number | null | undefined) => v ?? 0;
  const utObt = UT_KEYS.reduce((s, k) => s + n(obtained[k]), 0);
  const i_ii = n(obtained.terminal) + n(obtained.terminal2);
  const iii = n(obtained.terminal3);
  const ut = UT_MAX ? (utObt / UT_MAX) * AGGREGATE_WEIGHTS.ut : 0;
  const termI_II = TERM_I_II_MAX ? (i_ii / TERM_I_II_MAX) * AGGREGATE_WEIGHTS.termI_II : 0;
  const termIII = TERM_III_MAX ? (iii / TERM_III_MAX) * AGGREGATE_WEIGHTS.termIII : 0;
  return { ut, termI_II, termIII, total: ut + termI_II + termIII };
}

// ── Extra (non-scholastic) report-card rows ───────────────────────────────
// Captured per student, per exam in the `report_extras` table. `marks` rows
// carry a numeric out of `max`; `grade` rows an A–E letter; `count` rows an
// integer (attendance days). The marksheet renders one row per field with a
// cell under every exam column.
export type ExtraKind = "marks" | "grade" | "count";
export type ExtraField = { key: string; label: string; kind: ExtraKind; max?: number };

export const EXTRA_FIELDS: ExtraField[] = [
  { key: "eng_dictation", label: "English Dictation", kind: "marks", max: 10 },
  { key: "eng_handwriting", label: "English Hand Writing", kind: "marks", max: 5 },
  { key: "hin_dictation", label: "Hindi Dictation", kind: "marks", max: 5 },
  { key: "hin_handwriting", label: "Hindi Hand Writing", kind: "marks", max: 5 },
  { key: "moral_science", label: "Moral Science", kind: "grade" },
  { key: "drawing", label: "Drawing", kind: "grade" },
  { key: "supw", label: "SUPW", kind: "grade" },
  { key: "working_days", label: "No of Working Days", kind: "count" },
  { key: "days_present", label: "No of Days Present", kind: "count" },
];

export const EXTRA_FIELD_KEYS = EXTRA_FIELDS.map((f) => f.key);
export function isExtraField(v: string): boolean {
  return EXTRA_FIELD_KEYS.includes(v);
}
export function extraByKey(key: string): ExtraField | undefined {
  return EXTRA_FIELDS.find((f) => f.key === key);
}

// Extras lookup keyed "field:exam" → stored string value (or undefined).
export type ExtrasMap = Record<string, string>;
export function extraKey(field: string, exam: string): string {
  return `${field}:${exam}`;
}
