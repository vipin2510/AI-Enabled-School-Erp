/* eslint-disable jsx-a11y/alt-text */
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";

export type TcBranding = {
  name: string;
  line1?: string;
  line2?: string;
  diseCode?: string;
};

export type TcData = {
  tc_no: string | null;
  academic_year: string;
  admission_no: string | null;
  student_name: string | null;
  father_name: string | null;
  mother_name: string | null;
  date_of_birth: string | null;
  caste: string | null;
  admission_date: string | null;
  date_of_leaving: string | null;
  school_days_attended: string | null;
  studying_class: string | null;
  last_exam_class: string | null;
  last_exam_year: string | null;
  last_exam_result: string | null;
  promoted_to_class: string | null;
  admitted_in: string | null;
  conduct: string | null;
  reason: string | null;
  no_dues_amount: number | null;
  issued_on: string | null;
};

const DEFAULT_TC_BRANDING: TcBranding = {
  name: "ADESHWAR PUBLIC SCHOOL",
  line1: "KONDAGAON-494226, Distt.-Kondagaon (C.G.)",
  line2: "Affiliated to CISCE Board, New Delhi · School Code: CG024",
  diseCode: "22172604322",
};

function fmt(s: string | null | undefined) {
  if (!s) return "";
  // date strings (YYYY-MM-DD) → DD/MM/YYYY; anything else passes through.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
}

const CLASS_WORDS: Record<string, string> = {
  "1": "First", "2": "Second", "3": "Third", "4": "Fourth", "5": "Fifth",
  "6": "Sixth", "7": "Seventh", "8": "Eighth", "9": "Ninth", "10": "Tenth",
  "11": "Eleventh", "12": "Twelfth",
};
function classWords(c: string | null | undefined) {
  if (!c) return "";
  const digits = String(c).replace(/[^0-9]/g, "");
  return CLASS_WORDS[digits] ?? "";
}

const styles = StyleSheet.create({
  page: { fontFamily: "Times-Roman", fontSize: 11, padding: 28, color: "#1c1917" },
  border: { borderWidth: 2, borderColor: "#1c1917", padding: 18, flexGrow: 1 },
  headerRow: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#1c1917", paddingBottom: 8, marginBottom: 4 },
  logo: { width: 54, height: 54, marginRight: 12 },
  schoolName: { fontSize: 22, fontWeight: 700, fontFamily: "Times-Bold" },
  sub: { fontSize: 9, color: "#44403c" },
  diseBox: { alignSelf: "center", borderWidth: 1, borderColor: "#1c1917", paddingHorizontal: 4, paddingVertical: 1, fontSize: 8, marginTop: 2, marginBottom: 2 },
  title: { textAlign: "center", fontSize: 13, fontFamily: "Times-Bold", textDecoration: "underline", marginVertical: 8, letterSpacing: 1 },
  topRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  body: { fontSize: 11, lineHeight: 1.9 },
  b: { fontFamily: "Times-Bold" },
  sigRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 34 },
  sig: { width: 150, height: 40, objectFit: "contain" },
  sigLabel: { borderTopWidth: 1, borderTopColor: "#1c1917", paddingTop: 3, width: 150, textAlign: "center", fontSize: 10 },
});

// Underlined fill-in value; renders a min-width blank when empty.
function Fill({ children, min = 60 }: { children?: string; min?: number }) {
  return (
    <Text style={{ fontFamily: "Times-Bold", textDecoration: "underline" }}>
      {" "}{children && children.length ? children : " ".repeat(Math.max(6, Math.floor(min / 5)))}{" "}
    </Text>
  );
}

export function TransferCertificatePdf({
  data,
  branding = DEFAULT_TC_BRANDING,
  logoDataUrl,
  principalSignatureUrl,
}: {
  data: TcData;
  branding?: TcBranding;
  logoDataUrl?: string | null;
  principalSignatureUrl?: string | null;
}) {
  const rel = "son/daughter of";
  const paidUpto = data.no_dues_amount && Number(data.no_dues_amount) > 0
    ? `have dues of Rs. ${Math.round(Number(data.no_dues_amount))}`
    : "have been paid";
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.border}>
          <View style={styles.headerRow}>
            {logoDataUrl ? <Image src={logoDataUrl} style={styles.logo} /> : null}
            <View style={{ flex: 1 }}>
              <Text style={styles.schoolName}>{branding.name}</Text>
              {branding.diseCode ? <Text style={styles.sub}>Dise Code - {branding.diseCode}</Text> : null}
              {branding.line1 ? <Text style={styles.sub}>{branding.line1}</Text> : null}
              {branding.line2 ? <Text style={styles.sub}>{branding.line2}</Text> : null}
            </View>
          </View>

          <Text style={styles.title}>TRANSFER CERTIFICATE</Text>

          <View style={styles.topRow}>
            <Text>T.C. No. <Fill min={80}>{data.tc_no ?? ""}</Fill></Text>
            <Text>Adm. No. <Fill min={70}>{data.admission_no ?? ""}</Fill></Text>
          </View>

          <View style={styles.body}>
            <Text>
              This is to certify that <Fill min={160}>{data.student_name ?? ""}</Fill> {rel}{" "}
              <Fill min={150}>{data.father_name ?? ""}</Fill> caste <Fill min={70}>{data.caste ?? ""}</Fill>
            </Text>
            <Text>
              was admitted into this school on (date) <Fill min={80}>{fmt(data.admission_date)}</Fill>{" "}
              on a transfer certificate from <Fill min={140}>{data.reason ?? ""}</Fill>
            </Text>
            <Text>
              and now leaves this school on <Fill min={80}>{fmt(data.date_of_leaving)}</Fill> after attending{" "}
              <Fill min={60}>{data.school_days_attended ?? ""}</Fill> number of school days in the academic year{" "}
              <Fill min={70}>{data.academic_year}</Fill>. He/she has been vaccinated. He/she was then studying in the
              (figures) <Fill min={40}>{(data.studying_class ?? "").replace(/[^0-9]/g, "") || (data.studying_class ?? "")}</Fill>{" "}
              (words) <Fill min={90}>{classWords(data.studying_class)}</Fill> standard, the school year being from April to March.
            </Text>
            <Text>
              All sums due to the school on his/her account <Fill min={120}>{paidUpto}</Fill> up to the end of{" "}
              <Fill min={70}>{fmt(data.date_of_leaving)}</Fill>.
            </Text>
            <Text>
              His/her date of birth according to the Admission Register is (in figures){" "}
              <Fill min={80}>{fmt(data.date_of_birth)}</Fill>.
            </Text>
            <Text>
              The last annual promotion examination <Fill min={70}>{data.last_exam_result ?? ""}</Fill> by him/her
              was that of class <Fill min={50}>{data.last_exam_class ?? ""}</Fill> in the year{" "}
              <Fill min={60}>{data.last_exam_year ?? ""}</Fill>. He/she is enrolled in class{" "}
              <Fill min={60}>{data.promoted_to_class ?? ""}</Fill>. His/her conduct is{" "}
              <Fill min={60}>{data.conduct ?? "Good"}</Fill>.
            </Text>
            <Text>He/She was admitted in <Fill min={120}>{data.admitted_in ?? ""}</Fill>.</Text>
          </View>

          <View style={styles.sigRow}>
            <Text>Date: <Fill min={80}>{fmt(data.issued_on)}</Fill></Text>
            <View style={{ alignItems: "center" }}>
              {principalSignatureUrl ? <Image src={principalSignatureUrl} style={styles.sig} /> : <View style={styles.sig} />}
              <Text style={styles.sigLabel}>PRINCIPAL</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export { DEFAULT_TC_BRANDING };
