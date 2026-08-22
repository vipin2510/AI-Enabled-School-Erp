/* eslint-disable jsx-a11y/alt-text */
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { type ReceiptBranding, DEFAULT_RECEIPT_BRANDING } from "@/components/receipt-pdf";
import { type CashbookDay, MODE_LABEL } from "@/lib/cashbook";

function inr(n: number | string) {
  const v = typeof n === "string" ? Number(n) : n;
  return "Rs. " + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(v || 0);
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
  title: { fontSize: 12, fontWeight: 700, marginBottom: 8, textAlign: "center", letterSpacing: 1 },

  summaryRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  summaryCard: { flex: 1, borderWidth: 1, borderColor: "#e7e5e4", borderRadius: 4, padding: 8 },
  summaryLabel: { fontSize: 7, color: "#78716c", textTransform: "uppercase" },
  summaryValue: { fontSize: 12, fontWeight: 700, marginTop: 2 },

  reconcile: { borderWidth: 1, borderColor: "#e7e5e4", borderRadius: 4, padding: 8, marginBottom: 12, fontSize: 9 },
  sectionTitle: { fontSize: 9, fontWeight: 700, marginTop: 8, marginBottom: 4 },
  table: { borderWidth: 1, borderColor: "#e7e5e4" },
  thead: { flexDirection: "row", backgroundColor: "#f5f5f4" },
  tr: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#e7e5e4" },
  th: { padding: 4, fontWeight: 700, fontSize: 8 },
  td: { padding: 4, fontSize: 8 },
  colDesc: { flex: 3 },
  colAmt: { flex: 1, textAlign: "right" },
  colMid: { flex: 1 },
  totalRow: { backgroundColor: "#f5f5f4", fontWeight: 700 },
  empty: { padding: 6, fontSize: 8, color: "#78716c", textAlign: "center" },
});

export function CashbookPdf({
  data,
  dateLabel,
  logoDataUrl,
  branding = DEFAULT_RECEIPT_BRANDING,
}: {
  data: CashbookDay;
  dateLabel: string;
  logoDataUrl: string;
  branding?: ReceiptBranding;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <Image src={logoDataUrl} style={styles.logo} />
          <View style={{ flex: 1 }}>
            <Text style={styles.schoolName}>{branding.name}</Text>
            {branding.line1 ? <Text style={styles.schoolSub}>{branding.line1}</Text> : null}
          </View>
        </View>
        <Text style={styles.title}>CASHBOOK · {dateLabel}</Text>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Opening cash</Text>
            <Text style={styles.summaryValue}>{inr(data.opening)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Collections</Text>
            <Text style={styles.summaryValue}>{inr(data.collections.total)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Expenses + deposits</Text>
            <Text style={styles.summaryValue}>{inr(data.expenses.total + data.deposits.total)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Closing cash</Text>
            <Text style={styles.summaryValue}>{inr(data.closing)}</Text>
          </View>
        </View>

        <View style={styles.reconcile}>
          <Text>
            Opening {inr(data.opening)} + Cash collected {inr(data.collections.cash)} − Cash expenses{" "}
            {inr(data.expenses.cashTotal)} − Deposited {inr(data.deposits.total)} ={" "}
            {inr(data.closing)}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Collections by mode</Text>
        <View style={styles.table}>
          <View style={styles.thead}>
            <Text style={[styles.th, styles.colDesc]}>Mode</Text>
            <Text style={[styles.th, styles.colMid]}># Receipts</Text>
            <Text style={[styles.th, styles.colAmt]}>Amount</Text>
          </View>
          {data.collections.byMode.length === 0 ? (
            <Text style={styles.empty}>No collections on this day.</Text>
          ) : (
            data.collections.byMode.map((m) => (
              <View key={m.mode} style={styles.tr}>
                <Text style={[styles.td, styles.colDesc]}>{MODE_LABEL[m.mode] ?? m.mode}</Text>
                <Text style={[styles.td, styles.colMid]}>{m.count}</Text>
                <Text style={[styles.td, styles.colAmt]}>{inr(m.amount)}</Text>
              </View>
            ))
          )}
        </View>

        <Text style={styles.sectionTitle}>Expenses ({inr(data.expenses.total)})</Text>
        <View style={styles.table}>
          <View style={styles.thead}>
            <Text style={[styles.th, styles.colDesc]}>Description</Text>
            <Text style={[styles.th, styles.colMid]}>Mode</Text>
            <Text style={[styles.th, styles.colAmt]}>Amount</Text>
          </View>
          {data.expenses.list.length === 0 ? (
            <Text style={styles.empty}>No expenses.</Text>
          ) : (
            data.expenses.list.map((e, i) => (
              <View key={i} style={styles.tr}>
                <Text style={[styles.td, styles.colDesc]}>
                  {e.description}
                  {e.category ? ` · ${e.category}` : ""}
                </Text>
                <Text style={[styles.td, styles.colMid]}>{MODE_LABEL[e.mode] ?? e.mode}</Text>
                <Text style={[styles.td, styles.colAmt]}>{inr(e.amount)}</Text>
              </View>
            ))
          )}
        </View>

        <Text style={styles.sectionTitle}>Bank deposits ({inr(data.deposits.total)})</Text>
        <View style={styles.table}>
          <View style={styles.thead}>
            <Text style={[styles.th, styles.colDesc]}>Bank</Text>
            <Text style={[styles.th, styles.colMid]}>Receipt #</Text>
            <Text style={[styles.th, styles.colAmt]}>Amount</Text>
          </View>
          {data.deposits.list.length === 0 ? (
            <Text style={styles.empty}>No deposits.</Text>
          ) : (
            data.deposits.list.map((d, i) => (
              <View key={i} style={styles.tr}>
                <Text style={[styles.td, styles.colDesc]}>{d.bank_name ?? "—"}</Text>
                <Text style={[styles.td, styles.colMid]}>{d.deposit_receipt_no ?? d.reference ?? "—"}</Text>
                <Text style={[styles.td, styles.colAmt]}>{inr(d.amount)}</Text>
              </View>
            ))
          )}
        </View>

        <Text style={styles.sectionTitle}>Receipts ({data.collections.list.length})</Text>
        <View style={styles.table}>
          <View style={styles.thead}>
            <Text style={[styles.th, styles.colDesc]}>Receipt # · Student</Text>
            <Text style={[styles.th, styles.colMid]}>Mode</Text>
            <Text style={[styles.th, styles.colAmt]}>Amount</Text>
          </View>
          {data.collections.list.length === 0 ? (
            <Text style={styles.empty}>No receipts.</Text>
          ) : (
            data.collections.list.map((c, i) => (
              <View key={i} style={styles.tr} wrap={false}>
                <Text style={[styles.td, styles.colDesc]}>
                  {c.receipt_no ?? "—"}
                  {c.student_name ? ` · ${c.student_name}` : ""}
                </Text>
                <Text style={[styles.td, styles.colMid]}>{MODE_LABEL[c.payment_mode ?? ""] ?? c.payment_mode}</Text>
                <Text style={[styles.td, styles.colAmt]}>{inr(c.amount_paid)}</Text>
              </View>
            ))
          )}
        </View>
      </Page>
    </Document>
  );
}
