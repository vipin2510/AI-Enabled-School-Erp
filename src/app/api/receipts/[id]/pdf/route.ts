import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import path from "node:path";
import fs from "node:fs/promises";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, getCurrentSchoolId } from "@/lib/auth";
import { getFeePrintLayout } from "@/lib/cache";
import { ReceiptPdf } from "@/components/receipt-pdf";

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

  // Load logo as base64 data URL so it embeds in the PDF.
  const logoPath = path.join(process.cwd(), "public", "letterhead", "aps-logo.jpeg");
  const logoBytes = await fs.readFile(logoPath);
  const logoDataUrl = `data:image/jpeg;base64,${logoBytes.toString("base64")}`;

  // School-wide print layout (orientation + copies per page). Falls back to
  // the historic 2-up portrait if unset or the table isn't migrated yet.
  const layout = await getFeePrintLayout(schoolId);

  const buf = await renderToBuffer(
    ReceiptPdf({ invoice: invoice as never, logoDataUrl, layout }) as never
  );

  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.receipt_no || "receipt"}.pdf"`,
    },
  });
}
