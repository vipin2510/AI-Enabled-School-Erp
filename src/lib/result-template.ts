// Shared schema for the Canva-style result card template editor.
// The same shape powers the on-screen editor canvas AND the
// @react-pdf/renderer output, so a template designed in the browser
// renders byte-identical to the PDF.
//
// All positions are expressed as percentages of the page (0–100) so a
// layout authored at A4 portrait still lays out cleanly when the admin
// flips the page to landscape.

import { z } from "zod";

// ─── Page metadata ───────────────────────────────────────────────────
export type PageSize = "a4-portrait" | "a4-landscape";

// Width × height in points (72 pt = 1 inch). Used by the PDF renderer
// when translating percentage boxes into absolute positions.
export const PAGE_DIMS: Record<PageSize, { w: number; h: number }> = {
  "a4-portrait": { w: 595.28, h: 841.89 },
  "a4-landscape": { w: 841.89, h: 595.28 },
};

// ─── Block box (position + size as % of page) ────────────────────────
export const BoxZ = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  w: z.number().min(1).max(100),
  h: z.number().min(1).max(100),
});
export type Box = z.infer<typeof BoxZ>;

// ─── Text style ──────────────────────────────────────────────────────
const FONT_FAMILIES = ["Helvetica", "Times-Roman", "Courier"] as const;
const ALIGNS = ["left", "center", "right"] as const;

export const TextStyleZ = z.object({
  fontFamily: z.enum(FONT_FAMILIES).default("Helvetica"),
  fontSize: z.number().min(4).max(72).default(10),
  fontWeight: z.union([z.literal(400), z.literal(700)]).default(400),
  color: z.string().default("#1c1917"),
  align: z.enum(ALIGNS).default("left"),
  // Decoration shows up on report-card title bars / signature lines.
  underline: z.boolean().default(false),
  italic: z.boolean().default(false),
  backgroundColor: z.string().nullable().default(null),
  paddingX: z.number().min(0).max(40).default(0),
  paddingY: z.number().min(0).max(40).default(0),
});
export type TextStyle = z.infer<typeof TextStyleZ>;

// ─── Variable bindings — what the editor can plug live data into ────
// Bindings resolve at render time against the same `ResultCardData`
// shape used by the legacy hardcoded template + the active school's
// metadata. Keep this set tight so the editor can offer a finite
// dropdown.
export const VAR_PATHS = [
  "school.name",
  "school.city",
  "school.code",
  "school.affiliation",
  "school.address",
  "school.mobile",
  "school.email",
  "session.academic_year",
  "session.term_label",
  "student.full_name",
  "student.admission_no",
  "student.class",
  "student.section",
  "student.class_and_section",
  "student.father_name",
  "student.mother_name",
  "student.dob",
  "student.contact_number",
  "result.total",
  "result.max",
  "result.percent",
  "result.grade",
  "result.status",
] as const;
export type VarPath = (typeof VAR_PATHS)[number];

// ─── Image sources ──────────────────────────────────────────────────
export const IMAGE_SOURCES = ["school.logo", "student.photo", "custom"] as const;
export type ImageSource = (typeof IMAGE_SOURCES)[number];

// ─── Blocks ─────────────────────────────────────────────────────────
const TextBlockZ = z.object({
  id: z.string(),
  type: z.literal("text"),
  box: BoxZ,
  // Either a free-form template string (e.g. "Class: {{student.class}}")
  // or a single bound variable. The renderer first interpolates {{…}}
  // tokens, then falls back to the raw `text` if no tokens were present.
  text: z.string(),
  bind: z.enum(VAR_PATHS).nullable().default(null),
  style: TextStyleZ,
});

const ImageBlockZ = z.object({
  id: z.string(),
  type: z.literal("image"),
  box: BoxZ,
  source: z.enum(IMAGE_SOURCES),
  // `custom` source uses this URL — uploads land in Supabase Storage
  // (storage helper added with the editor in src/lib/storage.ts).
  customUrl: z.string().nullable().default(null),
  fit: z.enum(["contain", "cover"]).default("contain"),
  opacity: z.number().min(0).max(1).default(1),
});

const LineBlockZ = z.object({
  id: z.string(),
  type: z.literal("line"),
  box: BoxZ,
  color: z.string().default("#1c1917"),
  thickness: z.number().min(0.25).max(8).default(1),
});

const SignatureBlockZ = z.object({
  id: z.string(),
  type: z.literal("signature"),
  box: BoxZ,
  label: z.string().default("Signature"),
  style: TextStyleZ,
});

// Marks-table column kinds — the data shape is fixed (subjects down,
// exams across, plus totals/grades). The editor exposes column toggles
// + per-column styling.
const MarksCellKindZ = z.enum([
  "exam.max",       // configured max for the exam stage
  "exam.marks",     // marks scored for that exam stage
  "exam.grade",     // letter grade for that exam stage (derived)
  "total.marks",    // grand total
  "total.max",      // grand max
  "total.percent",  // weighted percent
  "total.grade",    // overall grade
]);

const MarksColumnZ = z.object({
  id: z.string(),
  // Which exam stage this column belongs to. Use `__total__` for
  // grand-total columns that aren't tied to a single exam.
  examKey: z.string(),
  cell: MarksCellKindZ,
  label: z.string(),     // header text
  widthPct: z.number().min(2).max(40).default(8),
});

const MarksTableBlockZ = z.object({
  id: z.string(),
  type: z.literal("table.marks"),
  box: BoxZ,
  columns: z.array(MarksColumnZ).min(1),
  // Column for the subject name (always first). Width is configurable.
  subjectColumnWidthPct: z.number().min(10).max(50).default(28),
  headerStyle: TextStyleZ,
  bodyStyle: TextStyleZ,
  borderColor: z.string().default("#d6d3d1"),
  zebra: z.boolean().default(true),
});

const CoCurricularTableBlockZ = z.object({
  id: z.string(),
  type: z.literal("table.cocurricular"),
  box: BoxZ,
  headerStyle: TextStyleZ,
  bodyStyle: TextStyleZ,
  borderColor: z.string().default("#d6d3d1"),
});

const SummaryRowKindZ = z.enum([
  "total",   // "Total marks: 403 / 500"
  "percent", // "Percentage: 80.60%"
  "grade",   // "Grade: A"
  "status",  // "Result: PASS / FAIL"
]);

const SummaryBlockZ = z.object({
  id: z.string(),
  type: z.literal("table.summary"),
  box: BoxZ,
  rows: z.array(SummaryRowKindZ).min(1),
  style: TextStyleZ,
  borderColor: z.string().default("#d6d3d1"),
});

export const BlockZ = z.discriminatedUnion("type", [
  TextBlockZ,
  ImageBlockZ,
  LineBlockZ,
  SignatureBlockZ,
  MarksTableBlockZ,
  CoCurricularTableBlockZ,
  SummaryBlockZ,
]);
export type Block = z.infer<typeof BlockZ>;
export type TextBlock = z.infer<typeof TextBlockZ>;
export type ImageBlock = z.infer<typeof ImageBlockZ>;
export type LineBlock = z.infer<typeof LineBlockZ>;
export type SignatureBlock = z.infer<typeof SignatureBlockZ>;
export type MarksTableBlock = z.infer<typeof MarksTableBlockZ>;
export type CoCurricularTableBlock = z.infer<typeof CoCurricularTableBlockZ>;
export type SummaryBlock = z.infer<typeof SummaryBlockZ>;

export const LayoutZ = z.array(BlockZ);
export type Layout = z.infer<typeof LayoutZ>;

// ─── Variable resolver ──────────────────────────────────────────────
// Source data the renderer plugs into bindings. A superset of the
// existing ResultCardData (which lacks school metadata) so the same
// resolver works for both single-student and bulk renders.
export type TemplateData = {
  school: {
    name: string;
    city: string;
    code: string;
    affiliation: string;
    address: string;
    mobile: string;
    email: string;
    logoDataUrl: string;
    studentPhotoUrl?: string | null;
  };
  session: {
    academic_year: string;
    term_label: string;
  };
  student: {
    full_name: string;
    admission_no: string;
    class: string;
    section: string;
    father_name: string;
    mother_name: string;
    dob: string;
    contact_number: string;
  };
  result: {
    total: number;
    max: number;
    percent: number;
    grade: string;
    status: "PASS" | "FAIL";
  };
  // Pre-computed subject grid so the renderer doesn't need to know
  // about `marks` / `subjects` shapes.
  // Outer rows = subjects, inner record keyed by `${examKey}:${cellKind}`.
  marksGrid: {
    subjects: Array<{
      name: string;
      cells: Record<string, number | string>;
    }>;
    coCurricular: Array<{ name: string; grade: string | null }>;
  };
};

export function resolveBinding(path: VarPath, data: TemplateData): string {
  switch (path) {
    case "school.name":            return data.school.name;
    case "school.city":            return data.school.city;
    case "school.code":            return data.school.code;
    case "school.affiliation":     return data.school.affiliation;
    case "school.address":         return data.school.address;
    case "school.mobile":          return data.school.mobile;
    case "school.email":           return data.school.email;
    case "session.academic_year":  return data.session.academic_year;
    case "session.term_label":     return data.session.term_label;
    case "student.full_name":      return data.student.full_name;
    case "student.admission_no":   return data.student.admission_no;
    case "student.class":          return data.student.class;
    case "student.section":        return data.student.section;
    case "student.class_and_section":
      return data.student.section
        ? `${data.student.class} · ${data.student.section}`
        : data.student.class;
    case "student.father_name":    return data.student.father_name;
    case "student.mother_name":    return data.student.mother_name;
    case "student.dob":            return data.student.dob;
    case "student.contact_number": return data.student.contact_number;
    case "result.total":           return String(data.result.total);
    case "result.max":             return String(data.result.max);
    case "result.percent":         return `${data.result.percent.toFixed(2)}%`;
    case "result.grade":           return data.result.grade;
    case "result.status":          return data.result.status;
  }
}

// Interpolate `{{var.path}}` tokens inside a template string.
export function renderText(text: string, data: TemplateData): string {
  return text.replace(/\{\{\s*([a-z._]+)\s*\}\}/gi, (_m, raw: string) => {
    const path = raw as VarPath;
    if ((VAR_PATHS as readonly string[]).includes(path)) {
      return resolveBinding(path, data);
    }
    return "";
  });
}

// ─── Box helpers (percentage → points) ──────────────────────────────
export function boxToPoints(box: Box, pageSize: PageSize) {
  const { w: pw, h: ph } = PAGE_DIMS[pageSize];
  return {
    left: (box.x / 100) * pw,
    top: (box.y / 100) * ph,
    width: (box.w / 100) * pw,
    height: (box.h / 100) * ph,
  };
}

// Generate a new block id. crypto.randomUUID works on both the browser
// and Node 18+.
export function newBlockId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}
