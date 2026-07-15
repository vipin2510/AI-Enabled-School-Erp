import { requireRole, getCurrentSchoolId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadSchoolPdfSettings, PDF_FONTS } from "@/lib/pdf-settings";
import { saveFontSettings } from "./actions";

export const dynamic = "force-dynamic";

const field = "rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm";

function FontControls({
  prefix,
  family,
  scale,
}: {
  prefix: "receipt" | "id_card";
  family: string;
  scale: number;
}) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-stone-500">Font style</span>
        <select name={`${prefix}_font_family`} defaultValue={family} className={field}>
          {PDF_FONTS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-stone-500">Font size (0.7–1.4×)</span>
        <input
          name={`${prefix}_font_scale`}
          type="number"
          step="0.05"
          min="0.7"
          max="1.4"
          defaultValue={scale}
          className={field + " w-28"}
        />
      </label>
    </div>
  );
}

export default async function DocumentFontsPage() {
  const profile = await requireRole("admin", "manager");
  const schoolId = await getCurrentSchoolId(profile);
  const supabase = await createClient();
  const s = await loadSchoolPdfSettings(supabase, schoolId);

  return (
    <div className="max-w-2xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Document Fonts</h1>
        <p className="text-stone-500 text-sm">
          Choose the font style and size used when printing fee receipts and student ID cards.
          Sizes are a multiplier on the auto-fitted base size.
        </p>
      </header>

      <form action={saveFontSettings} className="space-y-6">
        <div className="card p-4">
          <div className="mb-3 font-medium">Fee receipts</div>
          <FontControls prefix="receipt" family={s.receipt_font_family} scale={s.receipt_font_scale} />
        </div>

        <div className="card p-4">
          <div className="mb-3 font-medium">ID cards</div>
          <FontControls prefix="id_card" family={s.id_card_font_family} scale={s.id_card_font_scale} />
        </div>

        <button className="rounded-lg bg-stone-900 px-4 py-2 text-sm text-stone-50">Save fonts</button>
      </form>
    </div>
  );
}
