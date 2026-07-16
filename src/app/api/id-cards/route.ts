import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { assetDataUrl } from "@/lib/pdf-assets";
import { loadSchoolPdfSettings } from "@/lib/pdf-settings";
import { createClient } from "@/lib/supabase/server";
import { requireRole, getCurrentSchoolId } from "@/lib/auth";
import { findSchool } from "@/lib/access";
import { makeDemoSchool } from "@/lib/demo";
import { currentAcademicYear } from "@/lib/results";
import {
  IdCardSheet,
  CM,
  type IdCardStudent,
  type IdCardSchool,
} from "@/components/id-card-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Upper bound on students rendered into a single ID-card sheet per invocation.
// Comfortably above any real class/section; guards against a runaway render.
const MAX_SHEET = 120;

const STUDENT_SELECT =
  "id, full_name, admission_no, section, date_of_birth, blood_group, father_name, contact_number, address, category, student_photo_url, classes(display_name)";

type Row = {
  full_name: string;
  admission_no: string | null;
  section: string | null;
  date_of_birth: string | null;
  blood_group: string | null;
  father_name: string | null;
  contact_number: string | null;
  address: string | null;
  category: "regular" | "rte" | "staff_child" | null;
  student_photo_url: string | null;
  classes: { display_name: string } | null;
};

function toCard(r: Row): IdCardStudent {
  return {
    full_name: r.full_name,
    admission_no: r.admission_no,
    className: `${r.classes?.display_name ?? ""}${r.section ? `-'${r.section}'` : ""}`.trim(),
    date_of_birth: r.date_of_birth,
    blood_group: r.blood_group,
    father_name: r.father_name,
    contact_number: r.contact_number,
    address: r.address,
    category: r.category ?? "regular",
    photoUrl: r.student_photo_url,
  };
}

// Fetch a remote image and inline it as a base64 data URL. @react-pdf otherwise
// fetches each image itself *during* render — serially, with no timeout — so a
// single unreachable/slow/corrupt photo throws and fails the entire sheet
// ("Download failed"). Resolving them here in parallel, tolerating failures,
// means a bad photo just falls back to the PHOTO placeholder instead of a 500.
// Downsize a Supabase-hosted photo to ID-card resolution via the storage
// image-transform endpoint. Originals are multi-hundred-KB phone photos; a card
// needs ~300px. This cuts the bytes we fetch, base64-encode, and serialise into
// the PDF by ~75% — the dominant per-render cost for a class sheet. Non-Supabase
// or already-parameterised URLs are left untouched.
function cardPhotoUrl(url: string | null): string | null {
  if (!url) return null;
  if (!url.includes("/storage/v1/object/public/") || url.includes("?")) return url;
  // NOTE: `resize=contain` is required — a width-only transform on this project
  // does NOT scale height proportionally (it returns e.g. 300×<original-height>,
  // a distorted sliver). `contain` bounds the width AND keeps the aspect ratio;
  // the card's own objectFit:cover then frames it.
  return url.replace("/object/public/", "/render/image/public/") + "?width=400&resize=contain&quality=75";
}

async function fetchImageDataUrl(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, { signal: controller.signal }).finally(() =>
      clearTimeout(timer)
    );
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) return null;
    return `data:${contentType};base64,${buf.toString("base64")}`;
  } catch {
    return null; // network error, timeout, abort — degrade to placeholder
  }
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
    // Guardrail: the whole sheet is rendered synchronously in one function
    // invocation (@react-pdf is CPU-bound). A real class is well under this;
    // a larger request is almost certainly a mistake and would burn a huge
    // amount of function CPU. Narrow by section instead.
    if (rows.length > MAX_SHEET) {
      return NextResponse.json(
        { error: `Too many students (${rows.length}) for one sheet. Filter by section (max ${MAX_SHEET}).` },
        { status: 413 }
      );
    }
    filename = `id-cards-class.pdf`;
  } else {
    return NextResponse.json({ error: "Provide studentId or classId" }, { status: 400 });
  }

  const logoDataUrl = await assetDataUrl("letterhead/aps-logo.jpeg");

  // Header info for the card — driven by the active school so each branch
  // prints its own identity (Kondagaon / Pharasgaon / Chipawand).
  const meta = profile.is_demo ? makeDemoSchool(schoolId) : findSchool(schoolId);
  const school: IdCardSchool = {
    name: meta?.name ?? "Adeshwar Public School",
    cityLine: meta?.location?.split(",")[0] ?? "Kondagaon",
    affiliation: meta?.board ? `Affiliated to ${meta.board}, New Delhi` : undefined,
    schoolCode: meta?.boardCode,
    addressLine: meta?.addressLine ?? meta?.location,
    pinCode: meta?.pinCode,
    mobile: meta?.mobile,
    email: meta?.email,
  };

  // Resolve every student photo to an inlined data URL in parallel, tolerating
  // failures, before handing them to the (synchronous) PDF renderer.
  const cards = rows.map(toCard);
  await Promise.all(
    cards.map(async (c) => {
      c.photoUrl = await fetchImageDataUrl(cardPhotoUrl(c.photoUrl));
    })
  );

  // Per-school configurable ID-card font (family + size multiplier).
  const pdfSettings = await loadSchoolPdfSettings(supabase, schoolId);

  const buf = await renderToBuffer(
    IdCardSheet({
      students: cards,
      session: currentAcademicYear(),
      school,
      logoDataUrl,
      cardW: wCm * CM,
      cardH: hCm * CM,
      perPage: studentId ? 1 : perPage,
      font: pdfSettings.id_card_font_family,
      fontScale: pdfSettings.id_card_font_scale,
      principalSignatureUrl: pdfSettings.principal_signature_url,
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
