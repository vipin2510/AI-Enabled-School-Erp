/* eslint-disable jsx-a11y/alt-text */
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";

export type IdCardStudent = {
  full_name: string;
  admission_no: string | null;
  className: string; // e.g. X "A"
  date_of_birth: string | null;
  blood_group: string | null;
  father_name: string | null;
  contact_number: string | null;
  address: string | null;
  category?: "regular" | "rte" | "staff_child";
  photoUrl: string | null;
};

export type IdCardSchool = {
  name: string;             // ADESHWAR PUBLIC SCHOOL
  cityLine: string;         // CHIKHALPUTI / KONDAGAON
  affiliation?: string;     // "AFFILIATED TO CISCE, NEW DELHI"
  schoolCode?: string;      // "CG 024"
  addressLine?: string;     // "Chikhalputi, Dist- Kondagaon (C.G)"
  pinCode?: string;         // "494226"
  mobile?: string;          // "9111005303"
  email?: string;           // "apskondagaon@gmail.com"
};

export const CM = 28.3465; // 1cm in PDF points

const GREEN = "#0f3d2e";
const GOLD = "#d4a017";
const NAME_GREEN = "#1d6b3e";

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
      position: "relative",
    },

    // ── Header (green block with school identity) ────────────────────────
    header: {
      backgroundColor: GREEN,
      paddingTop: 5,
      paddingBottom: 4,
      paddingHorizontal: 6,
      alignItems: "center",
    },
    schoolName: {
      color: "#ffffff",
      fontSize: base + 1.5,
      fontFamily: "Helvetica-Bold",
      textAlign: "center",
      letterSpacing: 0.4,
    },
    cityLine: {
      color: "#ffffff",
      fontSize: base + 0.5,
      fontFamily: "Helvetica-Bold",
      textAlign: "center",
      letterSpacing: 0.3,
    },
    headerSmall: {
      color: "#ffffff",
      fontSize: base - 1.4,
      textAlign: "center",
      marginTop: 1,
    },
    schoolCodeLine: {
      color: "#ffffff",
      fontSize: base - 0.8,
      fontFamily: "Helvetica-Bold",
      textAlign: "center",
      marginTop: 1,
    },
    contactRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      width: "100%",
      marginTop: 3,
      paddingHorizontal: 2,
    },
    contactCell: {
      color: "#ffffff",
      fontSize: base - 1.5,
      fontFamily: "Helvetica-Bold",
    },

    // ── Body ─────────────────────────────────────────────────────────────
    body: { flex: 1, padding: 6, position: "relative" },
    topRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 4,
    },
    admBlock: { flexDirection: "column" },
    admText: { fontSize: base, fontFamily: "Helvetica-Bold", color: "#111111" },
    categoryBadge: {
      marginTop: 2,
      paddingHorizontal: 4,
      paddingVertical: 1,
      fontSize: base - 1.5,
      fontFamily: "Helvetica-Bold",
      color: "#ffffff",
      backgroundColor: NAME_GREEN,
      alignSelf: "flex-start",
      borderRadius: 2,
    },
    sessionBlock: { flexDirection: "column", alignItems: "flex-end" },
    sessionLabel: {
      fontSize: base - 0.5,
      fontFamily: "Helvetica-Bold",
      color: "#c0392b",
    },
    sessionValue: {
      fontSize: base + 0.5,
      fontFamily: "Helvetica-Bold",
      color: "#c0392b",
    },

    photoRow: {
      flexDirection: "row",
      justifyContent: "center",
      marginBottom: 4,
    },
    photo: {
      width: cardW * 0.28,
      height: cardW * 0.34,
      borderWidth: 1,
      borderColor: "#999999",
      objectFit: "cover",
    },
    photoPlaceholder: {
      width: cardW * 0.28,
      height: cardW * 0.34,
      borderWidth: 1,
      borderColor: "#cccccc",
      alignItems: "center",
      justifyContent: "center",
    },

    watermark: {
      position: "absolute",
      left: "20%",
      top: "30%",
      width: "60%",
      height: "40%",
      opacity: 0.07,
    },

    name: {
      fontSize: base + 3,
      fontFamily: "Helvetica-Bold",
      color: NAME_GREEN,
      textAlign: "center",
      marginTop: 1,
      marginBottom: 5,
      letterSpacing: 0.5,
    },

    row: { flexDirection: "row", marginBottom: 1.4 },
    label: {
      width: cardW * 0.34,
      fontSize: base - 0.2,
      fontFamily: "Helvetica-Bold",
      color: "#111111",
    },
    value: {
      flex: 1,
      fontSize: base - 0.2,
      fontFamily: "Helvetica-Bold",
      color: "#111111",
    },

    // ── Footer (yellow bar) ──────────────────────────────────────────────
    footer: {
      height: 4,
      backgroundColor: GOLD,
    },
  });
}

function Card({
  s,
  session,
  school,
  logoDataUrl,
  styles,
}: {
  s: IdCardStudent;
  session: string;
  school: IdCardSchool;
  logoDataUrl: string;
  styles: ReturnType<typeof stylesFor>;
}) {
  const fullCity = [school.addressLine, school.pinCode].filter(Boolean).join(" ");
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.schoolName}>{school.name.toUpperCase()}</Text>
        <Text style={styles.cityLine}>{school.cityLine.toUpperCase()}</Text>
        {school.affiliation && (
          <Text style={styles.headerSmall}>({school.affiliation.toUpperCase()})</Text>
        )}
        {school.schoolCode && (
          <Text style={styles.schoolCodeLine}>School Code: {school.schoolCode}</Text>
        )}
        {fullCity && <Text style={styles.headerSmall}>{fullCity}</Text>}
        {(school.mobile || school.email) && (
          <View style={styles.contactRow}>
            <Text style={styles.contactCell}>{school.mobile ? `Mob: ${school.mobile}` : ""}</Text>
            <Text style={styles.contactCell}>{school.email ? `Email- ${school.email}` : ""}</Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        {/* Subtle watermark logo behind the body. */}
        <Image src={logoDataUrl} style={styles.watermark} />

        <View style={styles.topRow}>
          <View style={styles.admBlock}>
            <Text style={styles.admText}>Adm No: {s.admission_no || "—"}</Text>
            {s.category && s.category !== "regular" && (
              <Text style={styles.categoryBadge}>
                {s.category === "rte" ? "RTE" : "STAFF CHILD"}
              </Text>
            )}
          </View>
          <View style={styles.sessionBlock}>
            <Text style={styles.sessionLabel}>SESSION</Text>
            <Text style={styles.sessionValue}>{session}</Text>
          </View>
        </View>

        <View style={styles.photoRow}>
          {s.photoUrl ? (
            <Image src={s.photoUrl} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={{ fontSize: 6, color: "#999999" }}>PHOTO</Text>
            </View>
          )}
        </View>

        <Text style={styles.name}>{s.full_name.toUpperCase()}</Text>

        <Row styles={styles} label="CLASS" value={s.className || "—"} />
        <Row styles={styles} label="FATHER'S NAME" value={s.father_name || "—"} />
        <Row styles={styles} label="DOB" value={fmtDob(s.date_of_birth)} />
        <Row styles={styles} label="BLOOD GP" value={s.blood_group || "—"} />
        <Row styles={styles} label="ADDRESS" value={s.address || "—"} />
        <Row styles={styles} label="CONTACT NO" value={s.contact_number || "—"} />
      </View>

      <View style={styles.footer} />
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
  school,
  logoDataUrl,
  cardW,
  cardH,
  perPage,
}: {
  students: IdCardStudent[];
  session: string;
  school: IdCardSchool;
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
            <Card key={i} s={s} session={session} school={school} logoDataUrl={logoDataUrl} styles={styles} />
          ))}
        </Page>
      ))}
    </Document>
  );
}
