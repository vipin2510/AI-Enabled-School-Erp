import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { assetDataUrl } from "@/lib/pdf-assets";
import { createClient } from "@/lib/supabase/server";
import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import { findSchool, findGroup, DEMO_GROUP } from "@/lib/access";
import { makeDemoSchool } from "@/lib/demo";
import { rowsToXlsxBuffer, xlsxResponse } from "@/lib/xlsx-export";
import { StudentsListPdf, type StudentRow } from "@/components/students-list-pdf";
import { type ReceiptBranding } from "@/components/receipt-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Row = {
  full_name: string;
  section: string | null;
  admission_no: string | null;
  father_name: string | null;
  contact_number: string | null;
  status: string;
  classes: { display_name: string; ordinal: number } | null;
};

// GET /api/academics/students-export?format=xlsx|pdf&q=&class=&section=
// Exports the whole filtered student set (not just the current page).
export async function GET(req: Request) {
  const profile = await requireDepartment("academics");
  const schoolId = await getCurrentSchoolId(profile);
  const url = new URL(req.url);
  const format = url.searchParams.get("format") === "pdf" ? "pdf" : "xlsx";
  const q = url.searchParams.get("q") ?? "";
  const classFilter = url.searchParams.get("class") ?? "";
  const sectionFilter = url.searchParams.get("section") ?? "";

  const supabase = await createClient();

  // Pull the whole filtered set, paginated to stay under PostgREST's row cap.
  const all: Row[] = [];
  for (let from = 0; ; from += 1000) {
    let query = supabase
      .from("students")
      .select("full_name, section, admission_no, father_name, contact_number, status, classes(display_name, ordinal)")
      .eq("school_id", schoolId)
      .order("full_name", { ascending: true })
      .range(from, from + 999);
    if (q) query = query.or(`full_name.ilike.%${q}%,admission_no.ilike.%${q}%`);
    if (classFilter) query = query.eq("class_id", classFilter);
    if (sectionFilter) query = query.eq("section", sectionFilter);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const page = (data ?? []) as unknown as Row[];
    all.push(...page);
    if (page.length < 1000) break;
  }

  const subtitleParts = [
    classFilter ? all[0]?.classes?.display_name ?? "Class" : "All classes",
    sectionFilter ? `Section ${sectionFilter}` : "All sections",
  ];
  if (q) subtitleParts.push(`matching "${q}"`);
  const subtitle = subtitleParts.join(" · ");

  if (format === "xlsx") {
    const rows = all.map((s, i) => ({
      "S.No": i + 1,
      Name: s.full_name,
      Class: s.classes?.display_name ?? "",
      Section: s.section ?? "",
      "Admission No": s.admission_no ?? "",
      Father: s.father_name ?? "",
      Contact: s.contact_number ?? "",
      Status: s.status,
    }));
    const buf = rowsToXlsxBuffer(rows, {
      sheetName: "Students",
      headers: ["S.No", "Name", "Class", "Section", "Admission No", "Father", "Contact", "Status"],
    });
    return xlsxResponse(buf, "students.xlsx");
  }

  // PDF
  const school = profile.is_demo ? makeDemoSchool(schoolId) : findSchool(schoolId);
  const group = profile.is_demo ? DEMO_GROUP : school ? findGroup(school.groupId) : null;
  const logoDataUrl = await assetDataUrl(group?.logoPath ?? "/letterhead/aps-logo.jpeg");
  const branding: ReceiptBranding | undefined = school
    ? {
        name: school.name.toUpperCase(),
        line1: school.board
          ? `Affiliated to ${school.board} Board · ${school.location}`
          : school.location,
      }
    : undefined;

  const rows: StudentRow[] = all.map((s, i) => ({
    sno: i + 1,
    name: s.full_name,
    class_name: s.classes?.display_name ?? "—",
    section: s.section,
    admission_no: s.admission_no,
    father: s.father_name,
    contact: s.contact_number,
    status: s.status,
  }));

  const buf = await renderToBuffer(
    StudentsListPdf({ rows, subtitle, logoDataUrl, branding }) as never,
  );
  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="students.pdf"`,
    },
  });
}
