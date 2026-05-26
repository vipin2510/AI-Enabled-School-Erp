/* eslint-disable jsx-a11y/alt-text */
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";

export type IdCardStudent = {
  full_name: string;
  className: string; // e.g. I "A"
  date_of_birth: string | null;
  blood_group: string | null;
  father_name: string | null;
  contact_number: string | null;
  address: string | null;
  photoUrl: string | null;
};

export const CM = 28.3465; // 1cm in PDF points

const GREEN = "#0f3d2e";
const GOLD = "#d4a017";

function fmtDob(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`;
}

function stylesFor(cardW: number, cardH: number) {
  // Scale type to the card so 6×9cm and larger both read well.
  const base = Math.max(5, Math.min(8, cardW / 24));
  return StyleSheet.create({
    page: { padding: 16, flexDirection: "row", flexWrap: "wrap", alignContent: "flex-start" },
    card: {
      width: cardW,
      height: cardH,
      margin: 6,
      borderWidth: 1,
      borderColor: "#cccccc",
      borderRadius: 6,
      overflow: "hidden",
      backgroundColor: "#ffffff",
    },
    header: { backgroundColor: GREEN, paddingVertical: 4, paddingHorizontal: 4, alignItems: "center" },
    schoolName: { color: "#ffffff", fontSize: base + 1, fontWeight: 700, textAlign: "center" },
    schoolCity: { color: GOLD, fontSize: base, fontWeight: 700, textAlign: "center" },
    goldBar: { height: 2, backgroundColor: GOLD },
    body: { flex: 1, padding: 5 },
    topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    logo: { width: base * 3, height: base * 3 },
    photo: { width: cardW * 0.3, height: cardW * 0.36, borderWidth: 1, borderColor: "#999999", objectFit: "cover" },
    photoPlaceholder: {
      width: cardW * 0.3,
      height: cardW * 0.36,
      borderWidth: 1,
      borderColor: "#cccccc",
      alignItems: "center",
      justifyContent: "center",
    },
    session: { fontSize: base - 1, fontWeight: 700, color: GREEN, textAlign: "right" },
    name: { fontSize: base + 2, fontWeight: 700, color: GREEN, textAlign: "center", marginTop: 4, marginBottom: 3 },
    row: { flexDirection: "row", marginBottom: 1.5 },
    label: { width: cardW * 0.32, fontSize: base - 0.5, fontWeight: 700, color: "#222222" },
    value: { flex: 1, fontSize: base - 0.5, color: "#222222" },
    sign: { marginTop: "auto", alignItems: "flex-end" },
    signText: { fontSize: base - 1, color: "#444444" },
    footer: { backgroundColor: GREEN, paddingVertical: 3, paddingHorizontal: 3 },
    footerText: { color: "#ffffff", fontSize: base - 1.5, textAlign: "center", fontWeight: 700 },
  });
}

function Card({
  s,
  session,
  logoDataUrl,
  styles,
}: {
  s: IdCardStudent;
  session: string;
  logoDataUrl: string;
  styles: ReturnType<typeof stylesFor>;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.schoolName}>ADESHWAR PUBLIC SCHOOL</Text>
        <Text style={styles.schoolCity}>KONDAGAON</Text>
      </View>
      <View style={styles.goldBar} />

      <View style={styles.body}>
        <View style={styles.topRow}>
          <Image src={logoDataUrl} style={styles.logo} />
          {s.photoUrl ? (
            <Image src={s.photoUrl} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={{ fontSize: 5, color: "#999999" }}>PHOTO</Text>
            </View>
          )}
          <Text style={styles.session}>SESSION{"\n"}{session}</Text>
        </View>

        <Text style={styles.name}>{s.full_name.toUpperCase()}</Text>

        <Row styles={styles} label="CLASS" value={s.className || "—"} />
        <Row styles={styles} label="DOB" value={fmtDob(s.date_of_birth)} />
        <Row styles={styles} label="BLOOD GROUP" value={s.blood_group || "—"} />
        <Row styles={styles} label="FATHER'S NAME" value={s.father_name || "—"} />
        <Row styles={styles} label="CONTACT NO." value={s.contact_number || "—"} />
        <Row styles={styles} label="ADDRESS" value={s.address || "—"} />

        <View style={styles.sign}>
          <Text style={styles.signText}>Principal</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>KONDAGAON, CHHATTISGARH · PHONE NO. 9111005303</Text>
      </View>
    </View>
  );
}

function Row({
  styles,
  label,
  value,
}: {
  styles: ReturnType<typeof stylesFor>;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>: {value}</Text>
    </View>
  );
}

export function IdCardSheet({
  students,
  session,
  logoDataUrl,
  cardW,
  cardH,
  perPage,
}: {
  students: IdCardStudent[];
  session: string;
  logoDataUrl: string;
  cardW: number;
  cardH: number;
  perPage: number;
}) {
  const styles = stylesFor(cardW, cardH);
  const pages: IdCardStudent[][] = [];
  for (let i = 0; i < students.length; i += perPage) {
    pages.push(students.slice(i, i + perPage));
  }
  if (pages.length === 0) pages.push([]);

  return (
    <Document>
      {pages.map((group, pi) => (
        <Page key={pi} size="A4" style={styles.page}>
          {group.map((s, i) => (
            <Card key={i} s={s} session={session} logoDataUrl={logoDataUrl} styles={styles} />
          ))}
        </Page>
      ))}
    </Document>
  );
}
