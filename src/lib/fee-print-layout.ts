// Pure geometry for the fee-receipt print layout. No React / @react-pdf
// imports so both the server PDF renderer and the client settings preview can
// share one source of truth for "how do boxes tile the page".

export type FeePrintLayout = {
  orientation: "portrait" | "landscape";
  box_width_mm: number;
  box_height_mm: number;
  page_margin_mm: number;
  box_gap_mm: number;
  // Extra blank gutter on the LEFT edge of the School Copy only, so the filed
  // copy can be hole-punched without piercing the printed content. Student
  // Copy is unaffected.
  school_binding_mm: number;
};

// A4 in millimetres. @react-pdf renders points; 1 mm = 72/25.4 pt.
export const A4_SHORT_MM = 210;
export const A4_LONG_MM = 297;
export const PT_PER_MM = 72 / 25.4;

export function pageDims(orientation: FeePrintLayout["orientation"]) {
  return orientation === "portrait"
    ? { w: A4_SHORT_MM, h: A4_LONG_MM }
    : { w: A4_LONG_MM, h: A4_SHORT_MM };
}

export type Tiling = {
  pageWmm: number;
  pageHmm: number;
  marginMm: number;
  gapMm: number;
  cols: number;
  rows: number;
  perPage: number;
  // Box size actually drawn — clamped so a single box never overflows the
  // usable area even if the configured size is larger than the page.
  boxWmm: number;
  boxHmm: number;
  // Font scale relative to the historic half-A4 box (≈198 × 140 mm → 1.0).
  scale: number;
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// How many boxes of (box + gap) fit across `usable` with one fewer gap than
// boxes: usable ≥ n·box + (n−1)·gap  ⇔  n ≤ (usable + gap)/(box + gap).
function fitCount(usable: number, box: number, gap: number): number {
  if (box <= 0) return 1;
  return Math.max(1, Math.floor((usable + gap) / (box + gap)));
}

export function computeTiling(layout: FeePrintLayout): Tiling {
  const { w: pageWmm, h: pageHmm } = pageDims(layout.orientation);
  const marginMm = clamp(layout.page_margin_mm || 0, 0, 40);
  const gapMm = clamp(layout.box_gap_mm || 0, 0, 40);

  const usableW = Math.max(10, pageWmm - 2 * marginMm);
  const usableH = Math.max(10, pageHmm - 2 * marginMm);

  // Clamp the box so at least one always fits inside the usable area.
  const boxWmm = clamp(layout.box_width_mm || usableW, 20, usableW);
  const boxHmm = clamp(layout.box_height_mm || usableH, 20, usableH);

  const cols = fitCount(usableW, boxWmm, gapMm);
  const rows = fitCount(usableH, boxHmm, gapMm);

  // Shrink type as the box gets smaller than the ~198×140 baseline. Driven by
  // the tighter of the two dimensions so nothing overflows.
  const scale = clamp(Math.min(boxWmm / 198, boxHmm / 140), 0.4, 1.5);

  return {
    pageWmm,
    pageHmm,
    marginMm,
    gapMm,
    cols,
    rows,
    perPage: cols * rows,
    boxWmm,
    boxHmm,
    scale,
  };
}

// Quick-fill presets: given a target box count and the current page geometry,
// return the box size that tiles the usable area into that many cells.
export const COUNT_PRESETS = [1, 2, 4, 6] as const;
export type PresetCount = (typeof COUNT_PRESETS)[number];

function gridForCount(
  count: PresetCount,
  orientation: FeePrintLayout["orientation"],
): { rows: number; cols: number } {
  switch (count) {
    case 1:
      return { rows: 1, cols: 1 };
    case 4:
      return { rows: 2, cols: 2 };
    case 6:
      return orientation === "landscape" ? { rows: 2, cols: 3 } : { rows: 3, cols: 2 };
    case 2:
    default:
      return orientation === "landscape" ? { rows: 1, cols: 2 } : { rows: 2, cols: 1 };
  }
}

export function presetBoxSize(
  count: PresetCount,
  orientation: FeePrintLayout["orientation"],
  marginMm: number,
  gapMm: number,
): { box_width_mm: number; box_height_mm: number } {
  const { w: pageWmm, h: pageHmm } = pageDims(orientation);
  const usableW = pageWmm - 2 * marginMm;
  const usableH = pageHmm - 2 * marginMm;
  const { rows, cols } = gridForCount(count, orientation);
  const round1 = (n: number) => Math.round(n * 10) / 10;
  return {
    box_width_mm: round1((usableW - (cols - 1) * gapMm) / cols),
    box_height_mm: round1((usableH - (rows - 1) * gapMm) / rows),
  };
}
