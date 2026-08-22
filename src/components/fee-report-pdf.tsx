/* eslint-disable jsx-a11y/alt-text */
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { type ReceiptBranding, DEFAULT_RECEIPT_BRANDING } from "@/components/receipt-pdf";

export type FeeReportRow = {
  label: string;
  amount: number;
  paid: boolean;
};

export type FeeReceiptRow = {
  receipt_no: string | null;
  issued_at: string;
  payment_mode: string | null;
  amount_paid: number;
};

export type FeeReportData = {
  student: {
    full_name: string;
    admission_no: string | null;
    class_name: string;
    section: string | null;
    father_name: string | null;
    contact_number: string | null;
  };
  academicYear: string;
  oneTime: FeeReportRow[];
  monthly: FeeReportRow[];
  busLine: string | null;
  receipts: FeeReceiptRow[];
  totals: {
    annual: number;
    paid: number;
    openingDues: number;
    outstanding: number;
  };
  generatedOn: string;
};

function inr(n: number | string) {
  const v = typeof n === "string" ? Number(n) : n;
  return "Rs. " + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(v || 0);
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9, padding: 28, color: "#1c1917" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#a8a29e",
    paddingBottom: 8,
    marginBottom: 10,
  },
  logo: { width: 42, height: 42, marginRight: 10 },
  schoolName: { fontSize: 16, fontWeight: 700 },
  schoolSub: { fontSize: 8, color: "#57534e" },

  title: { fontSize: 12, fontWeight: 700, marginBottom: 6, textAlign: "center", letterSpacing: 1 },

  fieldGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 10 },
  field: { width: "33.333%", marginBottom: 4, paddingRight: 6 },
  fieldLabel: { fontSize: 7, color: "#78716c" },
  fieldValue: { fontSize: 9.5, fontWeight: 700 },

  summaryRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  summaryCard: { flex: 1, borderWidth: 1, borderColor: "#e7e5e4", borderRadius: 4, padding: 8 },
  summaryLabel: { fontSize: 7, color: "#78716c", textTransform: "uppercase" },
  summaryValue: { fontSize: 13, fontWeight: 700, marginTop: 2 },
  dueValue: { color: "#b45309" },

  sectionTitle: { fontSize: 9, fontWeight: 700, marginTop: 8, marginBottom: 4 },
  table: { borderWidth: 1, borderColor: "#e7e5e4" },
  thead: { flexDirection: "row", backgroundColor: "#f5f5f4" },
  tr: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#e7e5e4" },
  th: { padding: 4, fontWeight: 700, fontSize: 8 },
  td: { padding: 4, fontSize: 8 },
  colDesc: { flex: 3 },
  colAmt: { flex: 1, textAlign: "right" },
  colStatus: { flex: 1, textAlign: "right" },
  paidTag: { color: "#15803d", fontWeight: 700 },
  dueTag: { color: "#b91c1c", fontWeight: 700 },
  totalRow: { backgroundColor: "#f5f5f4", fontWeight: 700 },

  meta: { fontSize: 7, color: "#78716c", marginTop: 10 },
  sigRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 28 },
  sigBox: { width: 150, borderTopWidth: 1, borderTopColor: "#78716c", paddingTop: 3, fontSize: 7 },
});

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

function FeeTable({ rows }: { rows: FeeReportRow[] }) {
  return (
    <View style={styles.table}>
      <View style={styles.thead}>
        <Text style={[styles.th, styles.colDesc]}>Particulars</Text>
        <Text style={[styles.th, styles.colAmt]}>Amount</Text>
        <Text style={[styles.th, styles.colStatus]}>Status</Text>
      </View>
      {rows.map((r, i) => (
        <View key={i} style={styles.tr}>
          <Text style={[styles.td, styles.colDesc]}>{r.label}</Text>
          <Text style={[styles.td, styles.colAmt]}>{inr(r.amount)}</Text>
          <Text style={[styles.td, styles.colStatus, r.paid ? styles.paidTag : styles.dueTag]}>
            {r.paid ? "Paid" : "Due"}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function FeeReportPdf({
  data,
  logoDataUrl,
  branding = DEFAULT_RECEIPT_BRANDING,
}: {
  data: FeeReportData;
  logoDataUrl: string;
  branding?: ReceiptBranding;
}) {
  const s = data.student;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <Image src={logoDataUrl} style={styles.logo} />
          <View style={{ flex: 1 }}>
            <Text style={styles.schoolName}>{branding.name}</Text>
            {branding.line1 ? <Text style={styles.schoolSub}>{branding.line1}</Text> : null}
            {branding.line2 ? <Text style={styles.schoolSub}>{branding.line2}</Text> : null}
          </View>
        </View>

        <Text style={styles.title}>FEE STATEMENT · {data.academicYear}</Text>

        <View style={styles.fieldGrid}>
          <Field label="Student" value={s.full_name} />
          <Field
            label="Class"
            value={`${s.class_name}${s.section ? ` · ${s.section}` : ""}`}
          />
          <Field label="Admission No" value={s.admission_no ?? "—"} />
          <Field label="Father's Name" value={s.father_name ?? "—"} />
          <Field label="Contact" value={s.contact_number ?? "—"} />
          <Field label="Generated" value={fmtDate(data.generatedOn)} />
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Annual Fee</Text>
            <Text style={styles.summaryValue}>{inr(data.totals.annual)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Paid this session</Text>
            <Text style={styles.summaryValue}>{inr(data.totals.paid)}</Text>
          </View>
          {data.totals.openingDues > 0 ? (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Brought forward</Text>
              <Text style={styles.summaryValue}>{inr(data.totals.openingDues)}</Text>
            </View>
          ) : null}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Overall Fee Due</Text>
            <Text style={[styles.summaryValue, styles.dueValue]}>{inr(data.totals.outstanding)}</Text>
          </View>
        </View>

        {data.oneTime.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>One-time & Annual charges</Text>
            <FeeTable rows={data.oneTime} />
          </>
        )}

        {data.monthly.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Monthly fees</Text>
            <FeeTable rows={data.monthly} />
          </>
        )}

        {data.busLine ? <Text style={styles.meta}>{data.busLine}</Text> : null}

        {data.receipts.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Receipts this session</Text>
            <View style={styles.table}>
              <View style={styles.thead}>
                <Text style={[styles.th, styles.colDesc]}>Receipt #</Text>
                <Text style={[styles.th, { flex: 1 }]}>Date</Text>
                <Text style={[styles.th, { flex: 1 }]}>Mode</Text>
                <Text style={[styles.th, styles.colAmt]}>Amount</Text>
              </View>
              {data.receipts.map((r, i) => (
                <View key={i} style={styles.tr}>
                  <Text style={[styles.td, styles.colDesc]}>{r.receipt_no ?? "—"}</Text>
                  <Text style={[styles.td, { flex: 1 }]}>{fmtDate(r.issued_at)}</Text>
                  <Text style={[styles.td, { flex: 1 }]}>{r.payment_mode ?? "—"}</Text>
                  <Text style={[styles.td, styles.colAmt]}>{inr(r.amount_paid)}</Text>
                </View>
              ))}
              <View style={[styles.tr, styles.totalRow]}>
                <Text style={[styles.td, styles.colDesc, { textAlign: "right" }]}>Total Paid</Text>
                <Text style={[styles.td, { flex: 1 }]}> </Text>
                <Text style={[styles.td, { flex: 1 }]}> </Text>
                <Text style={[styles.td, styles.colAmt]}>{inr(data.totals.paid)}</Text>
              </View>
            </View>
          </>
        )}

        <Text style={styles.meta}>
          This is a computer-generated statement. Amounts marked &quot;Due&quot; are unpaid as of the
          generation date. Please clear all dues to avoid late fees.
        </Text>

        <View style={styles.sigRow}>
          <Text style={styles.sigBox}>Parent / Guardian</Text>
          <Text style={[styles.sigBox, { textAlign: "right" }]}>Authorised Signatory</Text>
        </View>
      </Page>
    </Document>
  );
}
