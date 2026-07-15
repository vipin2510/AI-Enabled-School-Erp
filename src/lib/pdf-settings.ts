import type { SupabaseClient } from "@supabase/supabase-js";

// @react-pdf ships three standard font families (no font files to register).
// Each has a matching bold variant, mapped by boldOf() below.
export const PDF_FONTS = ["Helvetica", "Times-Roman", "Courier"] as const;
export type PdfFont = (typeof PDF_FONTS)[number];

export function boldOf(family: string): string {
  switch (family) {
    case "Times-Roman":
      return "Times-Bold";
    case "Courier":
      return "Courier-Bold";
    default:
      return "Helvetica-Bold";
  }
}

export type SchoolPdfSettings = {
  principal_id: string | null;
  principal_signature_url: string | null;
  receipt_font_family: string;
  receipt_font_scale: number;
  id_card_font_family: string;
  id_card_font_scale: number;
};

export const PDF_SETTINGS_DEFAULTS: SchoolPdfSettings = {
  principal_id: null,
  principal_signature_url: null,
  receipt_font_family: "Helvetica",
  receipt_font_scale: 1.0,
  id_card_font_family: "Helvetica",
  id_card_font_scale: 1.0,
};

// Clamp a stored scale into a sane render range so a bad value can't blow up a
// layout. Falls back to 1.0 for non-numbers.
export function fontScale(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.max(0.7, Math.min(1.4, n));
}

// Read the per-school PDF appearance settings, falling back to defaults when the
// row (or the whole table, pre-migration) is absent. Tolerant by design — PDFs
// must never fail just because settings haven't been configured.
// The app's client is schema-typed to `erp`, which doesn't match the default
// `public` generic — accept any schema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any, any, any>;

export async function loadSchoolPdfSettings(
  supabase: AnySupabase,
  schoolId: string
): Promise<SchoolPdfSettings> {
  try {
    const { data } = await supabase
      .from("school_pdf_settings")
      .select(
        "principal_id, principal_signature_url, receipt_font_family, receipt_font_scale, id_card_font_family, id_card_font_scale"
      )
      .eq("school_id", schoolId)
      .maybeSingle();
    if (!data) return PDF_SETTINGS_DEFAULTS;
    return {
      principal_id: data.principal_id ?? null,
      principal_signature_url: data.principal_signature_url ?? null,
      receipt_font_family: data.receipt_font_family || "Helvetica",
      receipt_font_scale: fontScale(data.receipt_font_scale),
      id_card_font_family: data.id_card_font_family || "Helvetica",
      id_card_font_scale: fontScale(data.id_card_font_scale),
    };
  } catch {
    return PDF_SETTINGS_DEFAULTS;
  }
}
