"use server";

import { revalidatePath } from "next/cache";
import { requireRole, getCurrentSchoolId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PDF_FONTS, fontScale, type PdfFont } from "@/lib/pdf-settings";

function family(v: FormDataEntryValue | null): PdfFont {
  const s = String(v ?? "");
  return (PDF_FONTS as readonly string[]).includes(s) ? (s as PdfFont) : "Helvetica";
}

// Save the per-school receipt / ID-card fonts. Cross-cutting setting, so it's
// gated to admin/manager rather than a single department.
export async function saveFontSettings(formData: FormData) {
  const profile = await requireRole("admin", "manager");
  const schoolId = await getCurrentSchoolId(profile);
  const supabase = await createClient();

  await supabase.from("school_pdf_settings").upsert(
    {
      school_id: schoolId,
      receipt_font_family: family(formData.get("receipt_font_family")),
      receipt_font_scale: fontScale(formData.get("receipt_font_scale")),
      id_card_font_family: family(formData.get("id_card_font_family")),
      id_card_font_scale: fontScale(formData.get("id_card_font_scale")),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "school_id" }
  );

  revalidatePath("/settings/document-fonts");
}
