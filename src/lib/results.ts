// Single source of truth for the Results module's assessment scheme.
// The school runs four Unit Tests (25 marks each) plus a Terminal Examination
// (100 marks). Change the EXAMS array here and every screen, CSV template,
// import parser and report card follows automatically.

export type ExamKey = "ut1" | "ut2" | "ut3" | "ut4" | "terminal" | "terminal2";

export type Exam = {
  key: ExamKey;
  label: string; // full label, e.g. "Unit Test I"
  short: string; // compact label for table headers, e.g. "UT I"
  max: number;
};

export const EXAMS: Exam[] = [
  { key: "ut1", label: "Unit Test I", short: "UT I", max: 25 },
  { key: "ut2", label: "Unit Test II", short: "UT II", max: 25 },
  { key: "ut3", label: "Unit Test III", short: "UT III", max: 25 },
  { key: "ut4", label: "Unit Test IV", short: "UT IV", max: 25 },
  { key: "terminal", label: "Terminal Examination I", short: "Terminal I", max: 100 },
  { key: "terminal2", label: "Terminal Examination II", short: "Terminal II", max: 100 },
];

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

// The current academic year as "YYYY-YY". The session starts in April, so any
// month from April onward belongs to year→year+1.
export function currentAcademicYear(now = new Date()): string {
  const y = now.getFullYear();
  const startYear = now.getMonth() + 1 >= 4 ? y : y - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

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
// full scheme.
export function computeResult(
  subjects: { id: string; name: string }[],
  marks: MarksMap,
  exams: Exam[] = EXAMS
): { subjects: SubjectResult[]; total: number; max: number; percent: number; grade: string } {
  let grandTotal = 0;
  let grandMax = 0;

  const subjectResults: SubjectResult[] = subjects.map((s) => {
    const obtained = {} as Record<ExamKey, number | null>;
    let total = 0;
    let max = 0;
    for (const exam of exams) {
      const v = marks[markKey(s.id, exam.key)];
      obtained[exam.key] = v ?? null;
      if (v !== null && v !== undefined) {
        total += v;
        max += exam.max;
      }
    }
    grandTotal += total;
    grandMax += max;
    return {
      subjectId: s.id,
      name: s.name,
      obtained,
      total,
      max,
      percent: max ? (total / max) * 100 : 0,
    };
  });

  const percent = grandMax ? (grandTotal / grandMax) * 100 : 0;
  return {
    subjects: subjectResults,
    total: grandTotal,
    max: grandMax,
    percent,
    grade: gradeFor(percent),
  };
}
