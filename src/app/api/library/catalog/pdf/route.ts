import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { assetDataUrl } from "@/lib/pdf-assets";
import { createClient } from "@/lib/supabase/server";
import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import { findSchool, findGroup, DEMO_GROUP } from "@/lib/access";
import { makeDemoSchool } from "@/lib/demo";
import { BookCatalogPdf, type CatalogBook } from "@/components/book-catalog-pdf";
import { type ReceiptBranding } from "@/components/receipt-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// A hard cap so a runaway catalog can't blow the render up. Well above the
// current ~6k catalogue; if it's ever hit we say so rather than truncate silently.
const MAX_ROWS = 20000;

// GET /api/library/catalog/pdf?q= — full (filtered) catalogue, one row per copy.
export async function GET(req: Request) {
  const profile = await requireDepartment("library");
  const schoolId = await getCurrentSchoolId(profile);
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const supabase = await createClient();

  const books: CatalogBook[] = [];
  let capped = false;
  for (let from = 0; from < MAX_ROWS; from += 1000) {
    let query = supabase
      .from("books")
      .select("code, title, author, category, status")
      .eq("school_id", schoolId)
      .order("code")
      .range(from, from + 999);
    if (q) query = query.or(`title.ilike.%${q}%,code.ilike.%${q}%,author.ilike.%${q}%`);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const page = (data ?? []) as CatalogBook[];
    books.push(...page);
    if (page.length < 1000) break;
    if (from + 1000 >= MAX_ROWS) capped = true;
  }

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

  const subtitle = (q ? `matching "${q}"` : "all books") + (capped ? ` · first ${MAX_ROWS} shown` : "");

  const buf = await renderToBuffer(
    BookCatalogPdf({ books, subtitle, logoDataUrl, branding }) as never,
  );
  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="library-catalogue.pdf"`,
    },
  });
}
