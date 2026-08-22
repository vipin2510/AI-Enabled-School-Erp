/* eslint-disable jsx-a11y/alt-text */
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { type ReceiptBranding, DEFAULT_RECEIPT_BRANDING } from "@/components/receipt-pdf";

export type ExpenseVoucherData = {
  id: string;
  amount: number;
  category: string | null;
  description: string;
  spent_on: string | null;
  status: string;
  created_at: string;
  decided_at: string | null;
  decision_note: string | null;
  raised_by_name: string;
  decided_by_name: string | null;
};

function inr(n: number | string) {
  const v = typeof n === "string" ? Number(n) : n;
  return "Rs. " + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(v || 0);
}
function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 10, padding: 36, color: "#1c1917" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#a8a29e",
    paddingBottom: 8,
    marginBottom: 12,
  },
  logo: { width: 44, height: 44, marginRight: 10 },
  schoolName: { fontSize: 16, fontWeight: 700 },
  schoolSub: { fontSize: 8, color: "#57534e" },
  title: { fontSize: 13, fontWeight: 700, marginBottom: 12, textAlign: "center", letterSpacing: 1 },

  amountBox: {
    borderWidth: 1,
    borderColor: "#e7e5e4",
    borderRadius: 4,
    padding: 12,
    marginBottom: 14,
    alignItems: "center",
  },
  amountLabel: { fontSize: 8, color: "#78716c", textTransform: "uppercase" },
  amountValue: { fontSize: 22, fontWeight: 700, marginTop: 2 },

  row: { flexDirection: "row", marginBottom: 6 },
  label: { width: 120, fontSize: 9, color: "#78716c" },
  value: { flex: 1, fontSize: 10, fontWeight: 700 },

  sigRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 48 },
  sigBox: { width: 170, borderTopWidth: 1, borderTopColor: "#78716c", paddingTop: 3, fontSize: 8 },
  meta: { fontSize: 7, color: "#78716c", marginTop: 18 },
});

export function ExpenseVoucherPdf({
  data,
  logoDataUrl,
  branding = DEFAULT_RECEIPT_BRANDING,
}: {
  data: ExpenseVoucherData;
  logoDataUrl: string;
  branding?: ReceiptBranding;
}) {
  return (
    <Document>
      <Page size="A5" style={styles.page}>
        <View style={styles.headerRow}>
          <Image src={logoDataUrl} style={styles.logo} />
          <View style={{ flex: 1 }}>
            <Text style={styles.schoolName}>{branding.name}</Text>
            {branding.line1 ? <Text style={styles.schoolSub}>{branding.line1}</Text> : null}
          </View>
        </View>
        <Text style={styles.title}>EXPENSE VOUCHER</Text>

        <View style={styles.amountBox}>
          <Text style={styles.amountLabel}>Amount</Text>
          <Text style={styles.amountValue}>{inr(data.amount)}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Voucher No</Text>
          <Text style={styles.value}>{data.id.slice(0, 8).toUpperCase()}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Category</Text>
          <Text style={styles.value}>{data.category || "—"}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Description</Text>
          <Text style={styles.value}>{data.description}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Spent on</Text>
          <Text style={styles.value}>{fmtDate(data.spent_on ?? data.created_at)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Raised by</Text>
          <Text style={styles.value}>{data.raised_by_name}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Status</Text>
          <Text style={styles.value}>{data.status.toUpperCase()}</Text>
        </View>
        {data.decided_at ? (
          <View style={styles.row}>
            <Text style={styles.label}>Decision</Text>
            <Text style={styles.value}>
              {fmtDate(data.decided_at)}
              {data.decided_by_name ? ` · ${data.decided_by_name}` : ""}
              {data.decision_note ? ` — "${data.decision_note}"` : ""}
            </Text>
          </View>
        ) : null}

        <View style={styles.sigRow}>
          <Text style={styles.sigBox}>Prepared by</Text>
          <Text style={[styles.sigBox, { textAlign: "right" }]}>Authorised Signatory</Text>
        </View>
        <Text style={styles.meta}>Generated {fmtDate(data.created_at)} · computer-generated voucher.</Text>
      </Page>
    </Document>
  );
}
