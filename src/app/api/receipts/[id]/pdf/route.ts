import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { assetDataUrl } from "@/lib/pdf-assets";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, getCurrentSchoolId } from "@/lib/auth";
import { findSchool, findGroup, DEMO_GROUP } from "@/lib/access";
import { makeDemoSchool } from "@/lib/demo";
import { getFeePrintLayout } from "@/lib/cache";
import { loadSchoolPdfSettings } from "@/lib/pdf-settings";
import { ReceiptPdf, type ReceiptBranding } from "@/components/receipt-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await requireProfile();
  const schoolId = await getCurrentSchoolId(profile);
  const { id } = await params;
  const supabase = await createClient();

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select(
      "*, students(full_name, section, father_name, contact_number, classes(display_name)), invoice_items(description, kind, period_index, amount, waived, waiver_reason)"
    )
    .eq("school_id", schoolId)
    .eq("id", id)
    .single();

  if (error || !invoice) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }

  // Resolve the school's group for branding (logo + header). Falls back to
  // the Adeshwar letterhead logo if the group has no logo configured.
  // The ephemeral demo school isn't in the static SCHOOLS array, so synthesize
  // its branding; everything else resolves from the static tables.
  const school = profile.is_demo ? makeDemoSchool(schoolId) : findSchool(schoolId);
  const group = profile.is_demo ? DEMO_GROUP : school ? findGroup(school.groupId) : null;
  const logoRel = group?.logoPath ?? "/letterhead/aps-logo.jpeg";
  const logoDataUrl = await assetDataUrl(logoRel);

  // Header text from the school record (name + affiliation + code/phone).
  const branding: ReceiptBranding | undefined = school
    ? {
        name: school.name.toUpperCase(),
        line1: school.board
          ? `Affiliated to ${school.board} Board · ${school.location}`
          : school.location,
        line2: [
          school.boardCode ? `Code: ${school.boardCode}` : null,
          school.mobile,
        ]
          .filter(Boolean)
          .join(" · ") || undefined,
      }
    : undefined;

  // School-wide print layout (orientation + copies per page). Falls back to
  // the historic 2-up portrait if unset or the table isn't migrated yet.
  const layout = await getFeePrintLayout(schoolId);

  // Per-school configurable receipt font (family + size multiplier).
  const pdfSettings = await loadSchoolPdfSettings(supabase, schoolId);

  const buf = await renderToBuffer(
    ReceiptPdf({
      invoice: invoice as never,
      logoDataUrl,
      layout,
      branding,
      fontFamily: pdfSettings.receipt_font_family,
      fontScale: pdfSettings.receipt_font_scale,
    }) as never
  );

  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.receipt_no || "receipt"}.pdf"`,
    },
  });
}
