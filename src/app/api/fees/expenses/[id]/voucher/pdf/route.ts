import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { assetDataUrl } from "@/lib/pdf-assets";
import { createClient } from "@/lib/supabase/server";
import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import { findSchool, findGroup, DEMO_GROUP } from "@/lib/access";
import { makeDemoSchool } from "@/lib/demo";
import { ExpenseVoucherPdf, type ExpenseVoucherData } from "@/components/expense-voucher-pdf";
import { type ReceiptBranding } from "@/components/receipt-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await requireDepartment("fees");
  const schoolId = await getCurrentSchoolId(profile);
  const { id } = await params;
  const supabase = await createClient();

  const { data: e } = await supabase
    .from("expenses")
    .select("id, amount, category, description, spent_on, status, created_at, decided_at, decision_note, raised_by, decided_by")
    .eq("school_id", schoolId)
    .eq("id", id)
    .single();
  if (!e) return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  // Non-admins can only export their own vouchers.
  if (profile.role !== "admin" && e.raised_by !== profile.id) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const ids = [e.raised_by, e.decided_by].filter(Boolean) as string[];
  const { data: profs } = ids.length
    ? await supabase.from("profiles").select("id, full_name, phone").in("id", ids)
    : { data: [] };
  const nameById = new Map(
    ((profs ?? []) as { id: string; full_name: string | null; phone: string | null }[]).map(
      (p) => [p.id, p.full_name || p.phone || "—"],
    ),
  );

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

  const data: ExpenseVoucherData = {
    id: e.id,
    amount: Number(e.amount) || 0,
    category: e.category,
    description: e.description,
    spent_on: e.spent_on,
    status: e.status,
    created_at: e.created_at,
    decided_at: e.decided_at,
    decision_note: e.decision_note,
    raised_by_name: nameById.get(e.raised_by) ?? "—",
    decided_by_name: e.decided_by ? nameById.get(e.decided_by) ?? "admin" : null,
  };

  const buf = await renderToBuffer(ExpenseVoucherPdf({ data, logoDataUrl, branding }) as never);
  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="expense-voucher-${e.id.slice(0, 8)}.pdf"`,
    },
  });
}
