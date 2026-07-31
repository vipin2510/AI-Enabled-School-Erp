import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { assetDataUrl } from "@/lib/pdf-assets";
import { createClient } from "@/lib/supabase/server";
import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import { findSchool, findGroup } from "@/lib/access";
import { loadSchoolPdfSettings } from "@/lib/pdf-settings";
import { TransferCertificatePdf, DEFAULT_TC_BRANDING, type TcBranding } from "@/components/transfer-certificate-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Fetch a remote image and inline it as a data URL so react-pdf never makes a
// network call mid-render (mirrors the ID-card route).
async function inlineImage(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(t));
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length ? `data:${ct};base64,${buf.toString("base64")}` : null;
  } catch {
    return null;
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await requireDepartment("academics");
  const schoolId = await getCurrentSchoolId(profile);
  const { id } = await params;
  const supabase = await createClient();

  const { data: tc, error } = await supabase
    .from("transfer_certificates")
    .select("*")
    .eq("school_id", schoolId)
    .eq("id", id)
    .single();
  if (error || !tc) return NextResponse.json({ error: "TC not found" }, { status: 404 });

  const school = findSchool(schoolId);
  const group = school ? findGroup(school.groupId) : null;
  const logoRel = group?.logoPath ?? "/letterhead/aps-logo.jpeg";
  const logoDataUrl = await assetDataUrl(logoRel);

  const branding: TcBranding = school
    ? {
        name: school.name.toUpperCase(),
        line1: school.location,
        line2: [school.board ? `Affiliated to ${school.board} Board` : null, school.boardCode ? `School Code: ${school.boardCode}` : null].filter(Boolean).join(" · ") || undefined,
        diseCode: DEFAULT_TC_BRANDING.diseCode,
      }
    : DEFAULT_TC_BRANDING;

  const pdfSettings = await loadSchoolPdfSettings(supabase, schoolId);
  const principalSignatureUrl = await inlineImage(pdfSettings.principal_signature_url);

  const buf = await renderToBuffer(
    TransferCertificatePdf({ data: tc as never, branding, logoDataUrl, principalSignatureUrl }) as never,
  );

  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${(tc.tc_no || "transfer-certificate").replace(/\//g, "-")}.pdf"`,
    },
  });
}
