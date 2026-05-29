/* eslint-disable jsx-a11y/alt-text */
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";

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

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 9, fontFamily: "Helvetica" },
  copy: { flex: 1 },
  cutRow: { flexDirection: "row", alignItems: "center", marginVertical: 8 },
  cutLine: { flex: 1, borderBottomWidth: 1, borderBottomColor: "#a8a29e", borderStyle: "dashed" },
  cutText: { fontSize: 7, color: "#a8a29e", marginHorizontal: 6, letterSpacing: 1 },

  copyTag: { alignSelf: "flex-end", fontSize: 7, fontWeight: 700, color: "#78716c", letterSpacing: 1, marginBottom: 2 },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#a8a29e",
    paddingBottom: 5,
    marginBottom: 6,
    alignItems: "center",
  },
  logo: { width: 38, height: 38, marginRight: 8 },
  schoolName: { fontSize: 13, fontWeight: 700 },
  schoolSub: { fontSize: 7, color: "#57534e" },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 5 },
  receiptLabel: { fontSize: 7, color: "#78716c", letterSpacing: 1 },
  receiptNo: { fontSize: 11, fontWeight: 700 },

  grid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 5 },
  field: { width: "33.33%", marginBottom: 3, paddingRight: 6 },
  fieldLabel: { fontSize: 6.5, color: "#78716c" },
  fieldValue: { fontSize: 8.5, fontWeight: 700 },

  table: { borderWidth: 1, borderColor: "#e7e5e4" },
  thead: { flexDirection: "row", backgroundColor: "#f5f5f4" },
  tr: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#e7e5e4" },
  th: { padding: 3.5, fontWeight: 700, fontSize: 8 },
  td: { padding: 3.5, fontSize: 8 },
  colDesc: { flex: 3 },
  colAmt: { flex: 1, textAlign: "right" },
  totalRow: { backgroundColor: "#f5f5f4", fontWeight: 700 },
  meta: { fontSize: 7.5, color: "#57534e", marginTop: 3 },
  sigRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 18 },
  sigBox: { width: 130, borderTopWidth: 1, borderTopColor: "#78716c", paddingTop: 3, fontSize: 7.5 },
  strike: { textDecoration: "line-through", color: "#a8a29e" },
});

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
}: {
  invoice: Invoice;
  logoDataUrl: string;
  copyTag: string;
}) {
  const s = invoice.students;
  const lines = displayLines(invoice.invoice_items);
  return (
    <View style={styles.copy}>
      <Text style={styles.copyTag}>{copyTag}</Text>
      <View style={styles.headerRow}>
        <Image src={logoDataUrl} style={styles.logo} />
        <View>
          <Text style={styles.schoolName}>ADESHWAR PUBLIC SCHOOL</Text>
          <Text style={styles.schoolSub}>
            Affiliated to CISCE Board, New Delhi · Kondagaon, Dist. Kondagaon (C.G.)
          </Text>
          <Text style={styles.schoolSub}>
            Udise: 22172604322 · Mob: 9111005301, 9111005303 · apskondagaon@gmail.com
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

      <View style={styles.grid}>
        <Field label="Student" value={s.full_name} />
        <Field
          label="Class"
          value={`${s.classes?.display_name ?? "—"}${s.section ? ` · ${s.section}` : ""}`}
        />
        <Field label="Academic Year" value={invoice.academic_year} />
        <Field label="Father's Name" value={s.father_name ?? "—"} />
        <Field label="Contact" value={s.contact_number ?? "—"} />
        <Field label="Mode" value={invoice.payment_mode ?? "—"} />
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
      {invoice.created_by ? <Text style={styles.meta}>Collected by: {invoice.created_by}</Text> : null}

      <View style={styles.sigRow}>
        <Text style={styles.sigBox}>Signature (Parent)</Text>
        <Text style={[styles.sigBox, { textAlign: "right" }]}>Authorised Signatory</Text>
      </View>
    </View>
  );
}

export function ReceiptPdf({
  invoice,
  logoDataUrl,
}: {
  invoice: Invoice;
  logoDataUrl: string;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <ReceiptCopy invoice={invoice} logoDataUrl={logoDataUrl} copyTag="OFFICE COPY" />
        <View style={styles.cutRow}>
          <View style={styles.cutLine} />
          <Text style={styles.cutText}>✂  CUT HERE</Text>
          <View style={styles.cutLine} />
        </View>
        <ReceiptCopy invoice={invoice} logoDataUrl={logoDataUrl} copyTag="STUDENT COPY" />
      </Page>
    </Document>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}
