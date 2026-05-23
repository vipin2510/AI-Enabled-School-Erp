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

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica" },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#a8a29e",
    paddingBottom: 8,
    marginBottom: 12,
    alignItems: "center",
  },
  logo: { width: 56, height: 56, marginRight: 12 },
  schoolName: { fontSize: 18, fontWeight: 700 },
  schoolSub: { fontSize: 9, color: "#57534e" },
  receiptTitle: { textAlign: "center", marginBottom: 10 },
  receiptLabel: { fontSize: 8, color: "#78716c", letterSpacing: 1 },
  receiptNo: { fontSize: 13, fontWeight: 700 },
  grid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 12 },
  field: { width: "50%", marginBottom: 6, paddingRight: 8 },
  fieldLabel: { fontSize: 8, color: "#78716c" },
  fieldValue: { fontSize: 10, fontWeight: 700 },
  table: { borderWidth: 1, borderColor: "#e7e5e4", marginBottom: 8 },
  thead: { flexDirection: "row", backgroundColor: "#f5f5f4" },
  tr:    { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#e7e5e4" },
  th:    { padding: 6, fontWeight: 700 },
  td:    { padding: 6 },
  colDesc: { flex: 3 },
  colAmt:  { flex: 1, textAlign: "right" },
  totalRow: { backgroundColor: "#f5f5f4", fontWeight: 700 },
  meta: { fontSize: 9, color: "#57534e", marginBottom: 2 },
  sigRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 40 },
  sigBox: { width: 160, borderTopWidth: 1, borderTopColor: "#78716c", paddingTop: 4, fontSize: 9 },
  strike: { textDecoration: "line-through", color: "#a8a29e" },
});

function inr(n: number | string) {
  const v = typeof n === "string" ? Number(n) : n;
  return "Rs. " + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(v || 0);
}

function fmtDate(s: string) {
  const d = new Date(s);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function ReceiptPdf({
  invoice,
  logoDataUrl,
}: {
  invoice: Invoice;
  logoDataUrl: string;
}) {
  const s = invoice.students;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
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

        <View style={styles.receiptTitle}>
          <Text style={styles.receiptLabel}>FEE RECEIPT</Text>
          <Text style={styles.receiptNo}>{invoice.receipt_no}</Text>
        </View>

        <View style={styles.grid}>
          <Field label="Student" value={s.full_name} />
          <Field
            label="Class"
            value={`${s.classes?.display_name ?? "—"}${s.section ? ` · ${s.section}` : ""}`}
          />
          <Field label="Father's Name" value={s.father_name ?? "—"} />
          <Field label="Contact" value={s.contact_number ?? "—"} />
          <Field label="Academic Year" value={invoice.academic_year} />
          <Field label="Date" value={fmtDate(invoice.issued_at)} />
        </View>

        <View style={styles.table}>
          <View style={styles.thead}>
            <Text style={[styles.th, styles.colDesc]}>Particulars</Text>
            <Text style={[styles.th, styles.colAmt]}>Amount</Text>
          </View>
          {invoice.invoice_items.map((it, i) => (
            <View key={i} style={styles.tr}>
              <Text style={[styles.td, styles.colDesc]}>
                {it.description}{it.waived ? "  (waived)" : ""}
              </Text>
              <Text style={[styles.td, styles.colAmt, it.waived ? styles.strike : {}]}>
                {inr(it.amount)}
              </Text>
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

        <Text style={styles.meta}>
          Payment Mode: {invoice.payment_mode ?? "—"}
          {invoice.payment_ref ? `   Ref: ${invoice.payment_ref}` : ""}
        </Text>
        {invoice.notes ? <Text style={styles.meta}>Notes: {invoice.notes}</Text> : null}
        {invoice.created_by ? (
          <Text style={styles.meta}>Collected by: {invoice.created_by}</Text>
        ) : null}

        <View style={styles.sigRow}>
          <Text style={styles.sigBox}>Signature (Parent)</Text>
          <Text style={[styles.sigBox, { textAlign: "right" }]}>Authorised Signatory</Text>
        </View>
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
