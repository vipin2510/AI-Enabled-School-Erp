import {
  UT_KEYS,
  TERMINAL_KEYS,
  examByKey,
  examsForTerm,
  extraByKey,
  extraKey,
  aggregateForSubject,
  computeResult,
  hasAnyMark,
  type ExamKey,
  type MarksMap,
  type ExtrasMap,
} from "@/lib/results";
import type { MarksheetData, SubjectRow, GenericRow } from "@/components/result-card-pdf";

const UT_MAX = examByKey("ut1")?.max ?? 25;
const UT_MIN = Math.round(UT_MAX * 0.4); // 10 for a 25-mark UT
const TERMINAL_MAX = examByKey("terminal")?.max ?? 100;
const FULL_EXAM_COUNT = UT_KEYS.length + TERMINAL_KEYS.length;

export type BuildArgs = {
  schoolName: string;
  academicYear: string;
  className: string;
  section: string;
  studentName: string;
  subjects: { id: string; name: string }[];
  marks: MarksMap;
  extras: ExtrasMap;
  rank: number | null;
  highestPercent: number;
  // Scope the card to one term pack (e.g. "1" = half-yearly: UT I, UT II,
  // Terminal I). Omitted / "overall" → the full annual scheme. On a scoped
  // card the percentage/grand-total/rank are rebased to the term's exams, the
  // out-of-term columns are blank, and the annual aggregate block is blanked
  // (it only means something once all three terminals are in).
  term?: string | null;
};

// Assemble the full marksheet for one student: numeric subject rows plus the
// stack of generic rows below (grand total, percentage, dictation/handwriting,
// rank/highest, moral-science/drawing/SUPW, attendance days).
export function buildMarksheet(args: BuildArgs): MarksheetData {
  const termExams = examsForTerm(args.term);
  const active = new Set<ExamKey>(termExams.map((e) => e.key));
  const scoped = active.size < FULL_EXAM_COUNT; // a part-term (half-yearly) card
  // Rebase the result to the term's exams: percent is out of the term's max,
  // and `obtained` only carries the term's exams (others read as blank).
  const result = computeResult(args.subjects, args.marks, termExams);
  const n = args.subjects.length;
  // No marks entered yet → leave the student-level summary rows blank ("-")
  // rather than printing a computed 0% / lowest grade / fail for an ungraded student.
  const graded = hasAnyMark(args.marks);

  const subjectRows: SubjectRow[] = result.subjects.map((s) => {
    const ut = UT_KEYS.map((k) => (active.has(k) ? s.obtained[k] : null));
    const entered = ut.filter((v): v is number => v !== null && v !== undefined);
    const utTotal = entered.length ? entered.reduce((a, b) => a + b, 0) : null;
    const a = aggregateForSubject(s.obtained);
    return {
      name: s.name,
      utMax: UT_MAX,
      utMin: UT_MIN,
      terminalMax: TERMINAL_MAX,
      ut,
      utTotal,
      terminal: TERMINAL_KEYS.map((k) => (active.has(k) ? s.obtained[k] : null)),
      agg: scoped
        ? { ut: null, iII: null, iii: null, total: null }
        : { ut: a.ut, iII: a.termI_II, iii: a.termIII, total: a.total },
    };
  });

  const obtained = result.subjects.map((s) => s.obtained);
  const colSum = (k: ExamKey) => obtained.reduce((acc, o) => acc + (o[k] ?? 0), 0);
  const utColSums = UT_KEYS.map((k) => (active.has(k) ? colSum(k) : null));
  const tColSums = TERMINAL_KEYS.map((k) => (active.has(k) ? colSum(k) : null));
  const utTotalSum = subjectRows.reduce((a, r) => a + (r.utTotal ?? 0), 0);
  const avg = (sel: (a: SubjectRow["agg"]) => number | null) =>
    n ? subjectRows.reduce((a, r) => a + (sel(r.agg) ?? 0), 0) / n : 0;

  const rows: GenericRow[] = [];

  rows.push({
    label: "GRAND TOTAL",
    bold: true,
    utMaxCell: UT_MAX * n,
    utMinCell: UT_MIN * n,
    ut: utColSums,
    utTotal: utTotalSum,
    tMaxCell: TERMINAL_MAX * n,
    terminal: tColSums,
    agg: scoped
      ? ["", "", "", ""]
      : [avg((a) => a.ut), avg((a) => a.iII), avg((a) => a.iii), avg((a) => a.total)],
  });

  rows.push({
    label: "PERCENTAGE",
    ut: UT_KEYS.map((k) => (active.has(k) && n ? (colSum(k) / (UT_MAX * n)) * 100 : "")),
    terminal: TERMINAL_KEYS.map((k) => (active.has(k) && n ? (colSum(k) / (TERMINAL_MAX * n)) * 100 : "")),
    agg: ["", "", "", graded ? result.percent : ""],
  });

  const extraRow = (key: string): GenericRow => {
    const f = extraByKey(key);
    return {
      label: f?.label ?? key,
      maxCell: f?.max != null ? String(f.max) : undefined,
      ut: UT_KEYS.map((k) => (active.has(k) ? args.extras[extraKey(key, k)] ?? "" : "")),
      terminal: TERMINAL_KEYS.map((k) => (active.has(k) ? args.extras[extraKey(key, k)] ?? "" : "")),
    };
  };

  rows.push(extraRow("eng_dictation"));
  rows.push(extraRow("eng_handwriting"));
  rows.push(extraRow("hin_dictation"));
  rows.push(extraRow("hin_handwriting"));

  rows.push({ label: "RANK", agg: ["", "", "", args.rank ? String(args.rank) : "-"] });
  rows.push({
    label: "HIGHEST MARKS IN CLASS",
    agg: ["", "", "", args.highestPercent.toFixed(2)],
  });

  rows.push(extraRow("moral_science"));
  rows.push(extraRow("drawing"));
  rows.push(extraRow("supw"));
  rows.push(extraRow("working_days"));
  rows.push(extraRow("days_present"));

  return {
    schoolName: args.schoolName,
    academicYear: args.academicYear,
    className: args.className,
    section: args.section,
    studentName: args.studentName,
    subjects: subjectRows,
    rows,
  };
}
