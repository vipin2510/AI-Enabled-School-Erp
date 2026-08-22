import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { assetDataUrl } from "@/lib/pdf-assets";
import { createClient } from "@/lib/supabase/server";
import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import { findSchool, findGroup, DEMO_GROUP } from "@/lib/access";
import { makeDemoSchool } from "@/lib/demo";
import { getCashbookDay } from "@/lib/cashbook";
import { todayStr, prettyDate } from "@/lib/attendance";
import { CashbookPdf } from "@/components/cashbook-pdf";
import { type ReceiptBranding } from "@/components/receipt-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/fees/cashbook/pdf?date=YYYY-MM-DD — printable day cashbook.
export async function GET(req: Request) {
  const profile = await requireDepartment("fees");
  const schoolId = await getCurrentSchoolId(profile);
  const url = new URL(req.url);
  const raw = url.searchParams.get("date");
  const day = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : todayStr();

  const supabase = await createClient();
  const data = await getCashbookDay(supabase, schoolId, day);

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

  const buf = await renderToBuffer(
    CashbookPdf({ data, dateLabel: prettyDate(day), logoDataUrl, branding }) as never,
  );
  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="cashbook-${day}.pdf"`,
    },
  });
}
