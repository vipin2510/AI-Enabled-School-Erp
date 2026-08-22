/* eslint-disable jsx-a11y/alt-text */
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { type ReceiptBranding, DEFAULT_RECEIPT_BRANDING } from "@/components/receipt-pdf";

export type StudentRow = {
  sno: number;
  name: string;
  class_name: string;
  section: string | null;
  admission_no: string | null;
  father: string | null;
  contact: string | null;
  status: string;
};

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 8, padding: 24, color: "#1c1917" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#a8a29e",
    paddingBottom: 6,
    marginBottom: 8,
  },
  logo: { width: 34, height: 34, marginRight: 8 },
  schoolName: { fontSize: 13, fontWeight: 700 },
  schoolSub: { fontSize: 7, color: "#57534e" },
  subtitle: { fontSize: 9, marginBottom: 8, color: "#44403c" },

  table: { borderWidth: 1, borderColor: "#e7e5e4" },
  thead: { flexDirection: "row", backgroundColor: "#f5f5f4" },
  tr: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#e7e5e4" },
  th: { padding: 4, fontWeight: 700 },
  td: { padding: 4 },
  cSno: { width: 28, textAlign: "right" },
  cName: { flex: 2.4 },
  cClass: { flex: 1.2 },
  cAdm: { flex: 1 },
  cFather: { flex: 2.2 },
  cContact: { flex: 1.3 },
  cStatus: { flex: 1 },
  footer: { marginTop: 8, fontSize: 7, color: "#78716c" },
});

export function StudentsListPdf({
  rows,
  subtitle,
  logoDataUrl,
  branding = DEFAULT_RECEIPT_BRANDING,
}: {
  rows: StudentRow[];
  subtitle: string;
  logoDataUrl: string;
  branding?: ReceiptBranding;
}) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.headerRow}>
          <Image src={logoDataUrl} style={styles.logo} />
          <View style={{ flex: 1 }}>
            <Text style={styles.schoolName}>{branding.name}</Text>
            {branding.line1 ? <Text style={styles.schoolSub}>{branding.line1}</Text> : null}
          </View>
        </View>
        <Text style={styles.subtitle}>Students · {subtitle} · {rows.length} record(s)</Text>

        <View style={styles.table}>
          <View style={styles.thead} fixed>
            <Text style={[styles.th, styles.cSno]}>#</Text>
            <Text style={[styles.th, styles.cName]}>Name</Text>
            <Text style={[styles.th, styles.cClass]}>Class</Text>
            <Text style={[styles.th, styles.cAdm]}>Adm. No</Text>
            <Text style={[styles.th, styles.cFather]}>Father</Text>
            <Text style={[styles.th, styles.cContact]}>Contact</Text>
            <Text style={[styles.th, styles.cStatus]}>Status</Text>
          </View>
          {rows.map((r) => (
            <View key={r.sno} style={styles.tr} wrap={false}>
              <Text style={[styles.td, styles.cSno]}>{r.sno}</Text>
              <Text style={[styles.td, styles.cName]}>{r.name}</Text>
              <Text style={[styles.td, styles.cClass]}>
                {r.class_name}
                {r.section ? ` · ${r.section}` : ""}
              </Text>
              <Text style={[styles.td, styles.cAdm]}>{r.admission_no ?? "—"}</Text>
              <Text style={[styles.td, styles.cFather]}>{r.father ?? "—"}</Text>
              <Text style={[styles.td, styles.cContact]}>{r.contact ?? "—"}</Text>
              <Text style={[styles.td, styles.cStatus]}>{r.status}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
