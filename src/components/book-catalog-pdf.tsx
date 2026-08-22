/* eslint-disable jsx-a11y/alt-text */
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { type ReceiptBranding, DEFAULT_RECEIPT_BRANDING } from "@/components/receipt-pdf";

export type CatalogBook = {
  code: string;
  title: string;
  author: string | null;
  category: string | null;
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
  cCode: { flex: 1.1 },
  cTitle: { flex: 3 },
  cAuthor: { flex: 2 },
  cCat: { flex: 1.4 },
  cStatus: { flex: 1 },
});

// The catalog can be large (thousands of copies). react-pdf flows rows across
// pages automatically; the header repeats via `fixed`.
export function BookCatalogPdf({
  books,
  subtitle,
  logoDataUrl,
  branding = DEFAULT_RECEIPT_BRANDING,
}: {
  books: CatalogBook[];
  subtitle: string;
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
        <Text style={styles.subtitle}>Library Catalogue · {subtitle} · {books.length} copy/copies</Text>

        <View style={styles.table}>
          <View style={styles.thead} fixed>
            <Text style={[styles.th, styles.cSno]}>#</Text>
            <Text style={[styles.th, styles.cCode]}>Code</Text>
            <Text style={[styles.th, styles.cTitle]}>Title</Text>
            <Text style={[styles.th, styles.cAuthor]}>Author</Text>
            <Text style={[styles.th, styles.cCat]}>Category</Text>
            <Text style={[styles.th, styles.cStatus]}>Status</Text>
          </View>
          {books.map((b, i) => (
            <View key={`${b.code}-${i}`} style={styles.tr} wrap={false}>
              <Text style={[styles.td, styles.cSno]}>{i + 1}</Text>
              <Text style={[styles.td, styles.cCode]}>{b.code}</Text>
              <Text style={[styles.td, styles.cTitle]}>{b.title}</Text>
              <Text style={[styles.td, styles.cAuthor]}>{b.author ?? "—"}</Text>
              <Text style={[styles.td, styles.cCat]}>{b.category ?? "—"}</Text>
              <Text style={[styles.td, styles.cStatus]}>{b.status}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
