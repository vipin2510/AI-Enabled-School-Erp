import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import path from "node:path";
import fs from "node:fs/promises";
import { createClient } from "@/lib/supabase/server";
import { requireRole, getCurrentSchoolId } from "@/lib/auth";
import { currentAcademicYear } from "@/lib/results";
import { IdCardSheet, CM, type IdCardStudent } from "@/components/id-card-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STUDENT_SELECT =
  "id, full_name, section, date_of_birth, blood_group, father_name, contact_number, address, student_photo_url, classes(display_name)";

type Row = {
  full_name: string;
  section: string | null;
  date_of_birth: string | null;
  blood_group: string | null;
  father_name: string | null;
  contact_number: string | null;
  address: string | null;
  student_photo_url: string | null;
  classes: { display_name: string } | null;
};

function toCard(r: Row): IdCardStudent {
  return {
    full_name: r.full_name,
    className: `${r.classes?.display_name ?? ""}${r.section ? ` "${r.section}"` : ""}`.trim(),
    date_of_birth: r.date_of_birth,
    blood_group: r.blood_group,
    father_name: r.father_name,
    contact_number: r.contact_number,
    address: r.address,
    photoUrl: r.student_photo_url,
  };
}

// GET /api/id-cards?studentId=...                          → single card
// GET /api/id-cards?classId=...&section=&perPage=6&w=6&h=9 → whole class sheet
export async function GET(req: Request) {
  const profile = await requireRole("admin", "manager");
  const schoolId = await getCurrentSchoolId(profile);
  const url = new URL(req.url);
  const studentId = url.searchParams.get("studentId");
  const classId = url.searchParams.get("classId");
  const section = url.searchParams.get("section");

  // Layout knobs (cm → points), with sane bounds.
  const wCm = clamp(Number(url.searchParams.get("w")) || 6, 4, 12);
  const hCm = clamp(Number(url.searchParams.get("h")) || 9, 5, 16);
  const perPage = clamp(Math.round(Number(url.searchParams.get("perPage")) || 6), 1, 12);

  const supabase = await createClient();
  let rows: Row[] = [];
  let filename = "id-cards.pdf";

  if (studentId) {
    const { data } = await supabase
      .from("students")
      .select(STUDENT_SELECT)
      .eq("school_id", schoolId)
      .eq("id", studentId)
      .single();
    if (!data) return NextResponse.json({ error: "Student not found" }, { status: 404 });
    rows = [data as unknown as Row];
    filename = `id-card-${(data as unknown as Row).full_name.replace(/[^a-z0-9]+/gi, "-")}.pdf`;
  } else if (classId) {
    let q = supabase
      .from("students")
      .select(STUDENT_SELECT)
      .eq("school_id", schoolId)
      .eq("class_id", classId)
      .neq("status", "alumni")
      .order("full_name");
    if (section) q = q.eq("section", section);
    const { data } = await q;
    rows = (data ?? []) as unknown as Row[];
    if (rows.length === 0) return NextResponse.json({ error: "No students found" }, { status: 404 });
    filename = `id-cards-class.pdf`;
  } else {
    return NextResponse.json({ error: "Provide studentId or classId" }, { status: 400 });
  }

  const logoPath = path.join(process.cwd(), "public", "letterhead", "aps-logo.jpeg");
  const logoDataUrl = `data:image/jpeg;base64,${(await fs.readFile(logoPath)).toString("base64")}`;

  const buf = await renderToBuffer(
    IdCardSheet({
      students: rows.map(toCard),
      session: currentAcademicYear(),
      logoDataUrl,
      cardW: wCm * CM,
      cardH: hCm * CM,
      perPage: studentId ? 1 : perPage,
    }) as never
  );

  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
