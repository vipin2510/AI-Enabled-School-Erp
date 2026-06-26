"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { bustFeePrintCache } from "./actions";
import {
  type FeePrintLayout,
  computeTiling,
  pageDims,
  presetBoxSize,
  COUNT_PRESETS,
} from "@/lib/fee-print-layout";

type Orientation = FeePrintLayout["orientation"];
type Settings = FeePrintLayout & { id: string | null };

export default function FeesPrintLayoutForm({
  settings,
  schoolId,
}: {
  settings: Settings;
  schoolId: string;
}) {
  const [orientation, setOrientation] = useState<Orientation>(settings.orientation);
  const [boxW, setBoxW] = useState(String(settings.box_width_mm));
  const [boxH, setBoxH] = useState(String(settings.box_height_mm));
  const [margin, setMargin] = useState(String(settings.page_margin_mm));
  const [gap, setGap] = useState(String(settings.box_gap_mm));
  const [binding, setBinding] = useState(String(settings.school_binding_mm));
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const num = (s: string) => Number(s) || 0;
  const layout: FeePrintLayout = {
    orientation,
    box_width_mm: num(boxW),
    box_height_mm: num(boxH),
    page_margin_mm: num(margin),
    box_gap_mm: num(gap),
    school_binding_mm: num(binding),
  };
  const tiling = computeTiling(layout);

  const applyPreset = (count: (typeof COUNT_PRESETS)[number]) => {
    const { box_width_mm, box_height_mm } = presetBoxSize(
      count,
      orientation,
      num(margin),
      num(gap),
    );
    setBoxW(String(box_width_mm));
    setBoxH(String(box_height_mm));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const payload = {
      school_id: schoolId,
      orientation,
      box_width_mm: tiling.boxWmm,
      box_height_mm: tiling.boxHmm,
      page_margin_mm: tiling.marginMm,
      box_gap_mm: tiling.gapMm,
      school_binding_mm: Math.max(0, num(binding)),
      updated_at: new Date().toISOString(),
    };
    const { error: err } = await supabase
      .from("fee_print_settings")
      .upsert(payload, { onConflict: "school_id" });
    if (err) {
      setError(
        /relation .*fee_print_settings|does not exist|column/.test(err.message)
          ? "Run migration 0023 to create/upgrade the fee_print_settings table, then try again."
          : err.message,
      );
    } else {
      try { await bustFeePrintCache(); } catch { /* fall through to TTL */ }
      setSavedAt(new Date().toLocaleTimeString());
    }
    setSaving(false);
  };

  return (
    <div className="card p-6 space-y-6">
      <div>
        <div className="text-sm font-medium mb-2">Page orientation</div>
        <div className="flex gap-2">
          {(["portrait", "landscape"] as Orientation[]).map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => setOrientation(o)}
              className={`flex-1 rounded-lg border px-4 py-2 text-sm capitalize transition ${
                orientation === o
                  ? "border-stone-900 bg-stone-900 text-stone-50"
                  : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
              }`}
            >
              {o}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-sm font-medium mb-2">Box size (mm)</div>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <div className="text-xs text-stone-500 mb-1">Width</div>
            <Input type="number" value={boxW} min={20} step={1} onChange={(e) => setBoxW(e.target.value)} />
          </label>
          <label className="block">
            <div className="text-xs text-stone-500 mb-1">Height</div>
            <Input type="number" value={boxH} min={20} step={1} onChange={(e) => setBoxH(e.target.value)} />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-stone-500">Quick fill:</span>
          {COUNT_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => applyPreset(c)}
              className="rounded-md border border-stone-200 px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50"
            >
              {c} per page
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <div className="text-sm font-medium mb-1">Page margin (mm)</div>
          <Input type="number" value={margin} min={0} max={40} step={1} onChange={(e) => setMargin(e.target.value)} />
        </label>
        <label className="block">
          <div className="text-sm font-medium mb-1">Cut gap (mm)</div>
          <Input type="number" value={gap} min={0} max={40} step={1} onChange={(e) => setGap(e.target.value)} />
        </label>
      </div>

      <label className="block">
        <div className="text-sm font-medium mb-1">School-copy binding margin (mm)</div>
        <Input type="number" value={binding} min={0} max={40} step={1} onChange={(e) => setBinding(e.target.value)} />
        <p className="text-xs text-stone-500 mt-1">
          Blank gutter added on the left of the <span className="font-medium">School Copy</span>{" "}
          only, so it can be hole-punched and filed without the punch going
          through the printed content. The Student Copy is unaffected.
        </p>
      </label>

      <div>
        <div className="text-sm font-medium mb-2">Preview</div>
        <LayoutPreview layout={layout} />
        <p className="text-xs text-stone-500 mt-2">
          {tiling.cols * tiling.rows} box{tiling.cols * tiling.rows === 1 ? "" : "es"} per page
          {" "}({tiling.cols} across × {tiling.rows} down). Each box is one receipt copy; the
          School and Student copies repeat to fill the page. Dashed lines mark where to cut.
          {(tiling.boxWmm !== num(boxW) || tiling.boxHmm !== num(boxH)) &&
            " Box size was clamped to fit the page."}
        </p>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}
      {savedAt && <div className="text-sm text-green-700">Saved at {savedAt}</div>}

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

function LayoutPreview({ layout }: { layout: FeePrintLayout }) {
  const t = computeTiling(layout);
  const { w: pageWmm, h: pageHmm } = pageDims(layout.orientation);
  // Render the sheet to scale: pick a px-per-mm that keeps the long edge ~260px.
  const pxPerMm = 260 / Math.max(pageWmm, pageHmm);
  const boxes = Array.from({ length: t.cols * t.rows }, (_, i) =>
    i % 2 === 0 ? "School Copy" : "Student Copy",
  );

  return (
    <div className="flex justify-center rounded-lg border border-stone-200 bg-stone-50 p-4">
      <div
        className="relative bg-white shadow-sm ring-1 ring-stone-300"
        style={{ width: pageWmm * pxPerMm, height: pageHmm * pxPerMm }}
      >
        <div
          className="absolute flex flex-wrap content-start"
          style={{
            inset: t.marginMm * pxPerMm,
            gap: t.gapMm * pxPerMm,
          }}
        >
          {boxes.map((label, i) => {
            const isSchool = label === "School Copy";
            const gutterPx = isSchool ? layout.school_binding_mm * pxPerMm : 0;
            return (
              <div
                key={i}
                className="flex items-stretch overflow-hidden border border-dashed border-stone-300"
                style={{ width: t.boxWmm * pxPerMm, height: t.boxHmm * pxPerMm }}
              >
                {gutterPx > 0 && (
                  // Binding gutter — shaded strip with punch dots on the left.
                  <div
                    className="flex flex-col items-center justify-center gap-1 border-r border-dotted border-stone-300 bg-stone-100"
                    style={{ width: gutterPx }}
                  >
                    <span className="h-1 w-1 rounded-full bg-stone-400" />
                    <span className="h-1 w-1 rounded-full bg-stone-400" />
                  </div>
                )}
                <div className="flex flex-1 items-center justify-center text-center text-[8px] font-medium leading-tight text-stone-500">
                  {label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
