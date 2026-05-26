/* eslint-disable jsx-a11y/alt-text */
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";

export type BookLabel = { code: string; title: string; qrDataUrl: string };

const styles = StyleSheet.create({
  page: { padding: 18, flexDirection: "row", flexWrap: "wrap", alignContent: "flex-start" },
  label: {
    width: 150,
    height: 112,
    margin: 6,
    borderWidth: 1,
    borderColor: "#d6d3d1",
    borderRadius: 4,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
  },
  school: { fontSize: 6, color: "#78716c", marginBottom: 2 },
  qr: { width: 64, height: 64 },
  code: { fontSize: 11, fontWeight: 700, letterSpacing: 1, marginTop: 2 },
  title: { fontSize: 6.5, color: "#44403c", marginTop: 1, textAlign: "center" },
});

export function BookLabelSheet({ labels, perPage }: { labels: BookLabel[]; perPage: number }) {
  const pages: BookLabel[][] = [];
  const size = Math.max(1, perPage);
  for (let i = 0; i < labels.length; i += size) pages.push(labels.slice(i, i + size));
  if (pages.length === 0) pages.push([]);

  return (
    <Document>
      {pages.map((group, pi) => (
        <Page key={pi} size="A4" style={styles.page}>
          {group.map((l, i) => (
            <View key={i} style={styles.label}>
              <Text style={styles.school}>ADESHWAR PUBLIC SCHOOL · LIBRARY</Text>
              <Image src={l.qrDataUrl} style={styles.qr} />
              <Text style={styles.code}>{l.code}</Text>
              <Text style={styles.title}>{l.title.length > 40 ? l.title.slice(0, 40) + "…" : l.title}</Text>
            </View>
          ))}
        </Page>
      ))}
    </Document>
  );
}
