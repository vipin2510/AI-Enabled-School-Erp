/* eslint-disable jsx-a11y/alt-text */
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";
import {
  type FeePrintLayout as ReceiptLayout,
  computeTiling,
  PT_PER_MM,
} from "@/lib/fee-print-layout";

type Item = {
  description: string;
  kind?: string | null;
  period_index?: number | null;
  amount: number;
  waived: boolean;
};

type Invoice = {
  receipt_no: string | null;
  academic_year: string;
  issued_at: string;
  subtotal: number;
  late_fee: number;
  late_fee_waived: boolean;
  waiver_amount: number;
  waiver_reason: string | null;
  total: number;
  amount_paid: number;
  payment_mode: string | null;
  payment_ref: string | null;
  notes: string | null;
  created_by: string | null;
  students: {
    full_name: string;
    section: string | null;
    father_name: string | null;
    contact_number: string | null;
    classes: { display_name: string } | null;
  };
  invoice_items: Item[];
};

const MONTH_ABBR = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

// Print layout — set school-wide in Fees ▸ Settings ▸ Print Layout and read
// from `fee_print_settings`. Boxes of the configured mm size tile each sheet;
// each box is one receipt copy and the copy types cycle School → Student to
// fill the page. The geometry (cols/rows/scale) is computed by
// `computeTiling` so the live preview and this renderer never drift.
export type { ReceiptLayout };

export const DEFAULT_RECEIPT_LAYOUT: ReceiptLayout = {
  orientation: "portrait",
  box_width_mm: 99,
  box_height_mm: 142.5,
  page_margin_mm: 6,
  box_gap_mm: 0,
  school_binding_mm: 15,
};

// Base horizontal padding inside a box at scale 1.0 — mirrors the `box`
// style's paddingHorizontal so the School-Copy gutter can extend it.
const BOX_PAD_X = 18;

// All sizes are derived from `scale` so denser grids shrink uniformly.
// Border widths stay at 1 (hairlines) — scaling them below 1 makes the cut
// guides vanish on print.
function makeStyles(scale: number) {
  const u = (n: number) => n * scale;
  return StyleSheet.create({
    page: {
      fontFamily: "Helvetica",
      fontSize: u(9),
      flexDirection: "column",
    },
    // Grid container fills the sheet; boxes wrap row-major into it. Page
    // margin (padding) and box gap are stamped inline per layout.
    sheet: {
      width: "100%",
      height: "100%",
      flexDirection: "row",
      flexWrap: "wrap",
      alignContent: "flex-start",
    },
    // One receipt copy. Height/width are stamped inline per grid shape so the
    // boxes tile exactly. No `overflow: hidden`: the copy is rendered rotated
    // 90°, and react-pdf derives a rotated box's clip rect from its
    // POST-rotation bounds — clipping here would crop the card's real width
    // down to its height (≈22 mm off the header and amounts on each side).
    box: {
      paddingHorizontal: u(18),
      paddingVertical: u(12),
      flexDirection: "column",
    },
    cut: { borderColor: "#a8a29e", borderStyle: "dashed" },

    copyTag: {
      alignSelf: "flex-end",
      fontSize: u(7),
      fontWeight: 700,
      color: "#78716c",
      letterSpacing: u(1.5),
      marginBottom: u(3),
    },

    headerRow: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: "#a8a29e",
      paddingBottom: u(5),
      marginBottom: u(6),
      alignItems: "center",
    },
    logo: { width: u(36), height: u(36), marginRight: u(9) },
    schoolName: { fontSize: u(14), fontWeight: 700 },
    schoolSub: { fontSize: u(7.5), color: "#57534e" },

    titleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: u(5),
    },
    receiptLabel: { fontSize: u(7), color: "#78716c", letterSpacing: u(1.2) },
    receiptNo: { fontSize: u(12), fontWeight: 700 },

    fieldGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: u(6) },
    field: { width: "33.333%", marginBottom: u(3), paddingRight: u(6) },
    fieldLabel: { fontSize: u(7), color: "#78716c" },
    fieldValue: { fontSize: u(9), fontWeight: 700 },

    // Items table.
    table: { borderWidth: 1, borderColor: "#e7e5e4" },
    thead: { flexDirection: "row", backgroundColor: "#f5f5f4" },
    tr: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#e7e5e4" },
    th: { padding: u(4), fontWeight: 700, fontSize: u(8) },
    td: { padding: u(4), fontSize: u(8) },
    colDesc: { flex: 3 },
    colAmt: { flex: 1, textAlign: "right" },
    totalRow: { backgroundColor: "#f5f5f4", fontWeight: 700 },
    strike: { textDecoration: "line-through", color: "#a8a29e" },

    meta: { fontSize: u(7), color: "#57534e", marginTop: u(3) },
    sigRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: "auto", // pin signatures to the bottom of the box
      paddingTop: u(14),
    },
    sigBox: {
      width: u(130),
      borderTopWidth: 1,
      borderTopColor: "#78716c",
      paddingTop: u(3),
      fontSize: u(7),
    },
  });
}

type Styles = ReturnType<typeof makeStyles>;

function inr(n: number | string) {
  const v = typeof n === "string" ? Number(n) : n;
  return "Rs. " + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(v || 0);
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Collapse all (non-waived) monthly items into one line listing the months,
// e.g. "Monthly Fee (APR, MAY, JUN)". Everything else stays as its own line.
function displayLines(items: Item[]): { description: string; amount: number; waived: boolean }[] {
  const monthly = items.filter((i) => i.kind === "monthly" && !i.waived && i.period_index);
  const rest = items.filter((i) => !(i.kind === "monthly" && !i.waived && i.period_index));

  const lines = rest.map((i) => ({ description: i.description, amount: Number(i.amount), waived: i.waived }));

  if (monthly.length) {
    const months = monthly
      .map((i) => i.period_index as number)
      .sort((a, b) => a - b)
      .map((m) => MONTH_ABBR[(m - 1) % 12]);
    const amount = monthly.reduce((s, i) => s + Number(i.amount), 0);
    lines.push({
      description: `Monthly Fee (${months.join(", ")})`,
      amount,
      waived: false,
    });
  }
  return lines;
}

function ReceiptCopy({
  invoice,
  logoDataUrl,
  copyTag,
  styles,
}: {
  invoice: Invoice;
  logoDataUrl: string;
  copyTag: string;
  styles: Styles;
}) {
  const s = invoice.students;
  const lines = displayLines(invoice.invoice_items);
  return (
    <>
      <Text style={styles.copyTag}>{copyTag}</Text>
      <View style={styles.headerRow}>
        <Image src={logoDataUrl} style={styles.logo} />
        <View style={{ flex: 1 }}>
          <Text style={styles.schoolName}>ADESHWAR PUBLIC SCHOOL</Text>
          <Text style={styles.schoolSub}>
            Affiliated to CISCE Board · Kondagaon (C.G.)
          </Text>
          <Text style={styles.schoolSub}>
            School Code: CG024 · 9111005301, 9111005303
          </Text>
        </View>
      </View>

      <View style={styles.titleRow}>
        <View>
          <Text style={styles.receiptLabel}>FEE RECEIPT</Text>
          <Text style={styles.receiptNo}>{invoice.receipt_no}</Text>
        </View>
        <Text style={styles.fieldValue}>{fmtDate(invoice.issued_at)}</Text>
      </View>

      <View style={styles.fieldGrid}>
        <Field styles={styles} label="Student" value={s.full_name} />
        <Field
          styles={styles}
          label="Class"
          value={`${s.classes?.display_name ?? "—"}${s.section ? ` · ${s.section}` : ""}`}
        />
        <Field styles={styles} label="Academic Year" value={invoice.academic_year} />
        <Field styles={styles} label="Father's Name" value={s.father_name ?? "—"} />
        <Field styles={styles} label="Contact" value={s.contact_number ?? "—"} />
        <Field styles={styles} label="Mode" value={invoice.payment_mode ?? "—"} />
      </View>

      <View style={styles.table}>
        <View style={styles.thead}>
          <Text style={[styles.th, styles.colDesc]}>Particulars</Text>
          <Text style={[styles.th, styles.colAmt]}>Amount</Text>
        </View>
        {lines.map((it, i) => (
          <View key={i} style={styles.tr}>
            <Text style={[styles.td, styles.colDesc]}>
              {it.description}{it.waived ? "  (waived)" : ""}
            </Text>
            <Text style={[styles.td, styles.colAmt, it.waived ? styles.strike : {}]}>{inr(it.amount)}</Text>
          </View>
        ))}
        <View style={[styles.tr, styles.totalRow]}>
          <Text style={[styles.td, styles.colDesc, { textAlign: "right" }]}>Subtotal</Text>
          <Text style={[styles.td, styles.colAmt]}>{inr(invoice.subtotal)}</Text>
        </View>
        {Number(invoice.waiver_amount) > 0 && (
          <View style={styles.tr}>
            <Text style={[styles.td, styles.colDesc, { textAlign: "right" }]}>
              Waiver{invoice.waiver_reason ? ` (${invoice.waiver_reason})` : ""}
            </Text>
            <Text style={[styles.td, styles.colAmt]}>- {inr(invoice.waiver_amount)}</Text>
          </View>
        )}
        <View style={styles.tr}>
          <Text style={[styles.td, styles.colDesc, { textAlign: "right" }]}>
            Late Fee{invoice.late_fee_waived ? " (waived)" : ""}
          </Text>
          <Text style={[styles.td, styles.colAmt]}>
            {invoice.late_fee_waived ? inr(0) : inr(invoice.late_fee)}
          </Text>
        </View>
        <View style={[styles.tr, styles.totalRow]}>
          <Text style={[styles.td, styles.colDesc, { textAlign: "right" }]}>Total Paid</Text>
          <Text style={[styles.td, styles.colAmt]}>{inr(invoice.amount_paid)}</Text>
        </View>
      </View>

      {invoice.payment_ref ? <Text style={styles.meta}>Ref: {invoice.payment_ref}</Text> : null}
      {invoice.created_by ? <Text style={styles.meta}>Generated by: {invoice.created_by}</Text> : null}

      <View style={styles.sigRow}>
        <Text style={styles.sigBox}>Signature (Parent)</Text>
        <Text style={[styles.sigBox, { textAlign: "right" }]}>Authorised Signatory</Text>
      </View>
    </>
  );
}

const COPY_TAGS = ["SCHOOL COPY", "STUDENT COPY"] as const;

export function ReceiptPdf({
  invoice,
  logoDataUrl,
  layout = DEFAULT_RECEIPT_LAYOUT,
}: {
  invoice: Invoice;
  logoDataUrl: string;
  layout?: ReceiptLayout;
}) {
  const t = computeTiling(layout);
  const { cols, rows, perPage } = t;

  // Each copy is rendered ROTATED 90° so a landscape-shaped receipt sits on
  // the portrait sheet (the school's filing format). The content therefore
  // lays out in the cell's *swapped* dimensions — width = box height, height =
  // box width — and the scale follows those swapped dims against the ~198×140
  // baseline so the type fills the rotated card instead of the upright cell.
  const contentScale = Math.min(1.5, Math.max(0.4, Math.min(t.boxHmm / 198, t.boxWmm / 140)));
  const styles = makeStyles(contentScale);

  // We print exactly the School and Student copy — nothing more. On a grid
  // with more than two cells (e.g. 2×2) the two copies fill the top row and
  // the remaining cells are left blank, so the receipts come from the top of
  // the sheet. A 1-box-per-page layout falls back to two pages — School then
  // Student.
  const totalCopies = COPY_TAGS.length;
  const tags = Array.from({ length: totalCopies }, (_, i) => COPY_TAGS[i % COPY_TAGS.length]);
  const pages: (typeof COPY_TAGS[number])[][] = [];
  for (let i = 0; i < tags.length; i += perPage) {
    pages.push(tags.slice(i, i + perPage));
  }

  const boxWpt = t.boxWmm * PT_PER_MM;
  const boxHpt = t.boxHmm * PT_PER_MM;
  const marginPt = t.marginMm * PT_PER_MM;
  const gapPt = t.gapMm * PT_PER_MM;
  // Every copy gets an extra blank gutter on its left for hole-punching, on
  // top of the content's normal padding, so either copy can be filed.
  const bindingPt = Math.max(0, layout.school_binding_mm || 0) * PT_PER_MM;

  return (
    <Document>
      {pages.map((pageTags, pi) => (
        <Page key={pi} size="A4" orientation={layout.orientation} style={styles.page}>
          <View style={[styles.sheet, { padding: marginPt }]}>
            {pageTags.map((tag, ci) => {
              const row = Math.floor(ci / cols);
              const col = ci % cols;
              // Internal dashed cut guides + gap; no border/gap past the grid.
              const spacing = {
                ...(col < cols - 1 ? { marginRight: gapPt, borderRightWidth: 1 } : {}),
                ...(row < rows - 1 ? { marginBottom: gapPt, borderBottomWidth: 1 } : {}),
              };
              // paddingLeft override extends the content's base padding by the
              // punch gutter — applied to every copy so both can be filed.
              const gutter =
                bindingPt > 0
                  ? { paddingLeft: BOX_PAD_X * contentScale + bindingPt }
                  : {};
              return (
                <View
                  key={ci}
                  style={[
                    styles.cut,
                    spacing,
                    // No `overflow: hidden` here: this is the rotating child's
                    // parent, and react-pdf would clip the rotated content in
                    // its PRE-rotation coordinate space (lopping ~22mm off each
                    // side of the landscape card). The inner card keeps its own
                    // overflow clip instead.
                    { width: boxWpt, height: boxHpt, position: "relative" },
                  ]}
                >
                  {/* Landscape content sized to the cell's swapped dims, then
                      rotated 90° about its centre so it fills the cell. */}
                  <View
                    style={[
                      styles.box,
                      gutter,
                      {
                        position: "absolute",
                        width: boxHpt,
                        height: boxWpt,
                        left: (boxWpt - boxHpt) / 2,
                        top: (boxHpt - boxWpt) / 2,
                        transform: "rotate(90deg)",
                        transformOrigin: "center",
                      },
                    ]}
                  >
                    <ReceiptCopy
                      invoice={invoice}
                      logoDataUrl={logoDataUrl}
                      copyTag={tag}
                      styles={styles}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </Page>
      ))}
    </Document>
  );
}

function Field({ label, value, styles }: { label: string; value: string; styles: Styles }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}
