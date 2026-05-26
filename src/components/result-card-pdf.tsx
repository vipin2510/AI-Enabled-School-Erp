/* eslint-disable jsx-a11y/alt-text */
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { gradeFor, passMark, type Exam, type ExamKey, type SubjectResult } from "@/lib/results";

export type ResultCardData = {
  student: {
    full_name: string;
    admission_no: string | null;
    father_name: string | null;
    mother_name: string | null;
  };
  className: string;
  section: string;
  academicYear: string;
  exams: Exam[];
  termLabel?: string;
  subjects: SubjectResult[];
  coCurricular: { name: string; grade: string | null }[];
  total: number;
  max: number;
  percent: number;
};

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: "Helvetica", color: "#1c1917" },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 2,
    borderBottomColor: "#0f172a",
    paddingBottom: 8,
    marginBottom: 10,
    alignItems: "center",
  },
  logo: { width: 52, height: 52, marginRight: 12 },
  schoolName: { fontSize: 17, fontWeight: 700 },
  schoolSub: { fontSize: 8, color: "#57534e" },
  title: {
    textAlign: "center",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1,
    backgroundColor: "#f5f5f4",
    paddingVertical: 4,
    marginBottom: 10,
    borderRadius: 3,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 10 },
  field: { width: "33.33%", marginBottom: 5, paddingRight: 8 },
  fieldLabel: { fontSize: 7, color: "#78716c", textTransform: "uppercase" },
  fieldValue: { fontSize: 10, fontWeight: 700 },

  table: { borderWidth: 1, borderColor: "#d6d3d1", borderRadius: 3, overflow: "hidden" },
  thead: { flexDirection: "row", backgroundColor: "#0f172a" },
  th: { padding: 5, fontWeight: 700, fontSize: 8, color: "#ffffff", textAlign: "center" },
  tr: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#e7e5e4" },
  trAlt: { backgroundColor: "#fafaf9" },
  td: { padding: 5, fontSize: 8, textAlign: "center" },
  subjectCell: { flex: 2.4, textAlign: "left", fontWeight: 700 },
  examCell: { flex: 1 },
  totalCell: { flex: 1.1, fontWeight: 700 },
  gradeCell: { flex: 0.9, fontWeight: 700 },
  footRow: { flexDirection: "row", backgroundColor: "#f5f5f4", borderTopWidth: 1, borderTopColor: "#d6d3d1" },
  footLabel: { flex: 2.4, padding: 5, fontSize: 8, fontWeight: 700, textAlign: "right" },

  summaryRow: { flexDirection: "row", marginTop: 12, gap: 10 },
  summaryBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d6d3d1",
    borderRadius: 4,
    padding: 8,
    alignItems: "center",
  },
  summaryLabel: { fontSize: 7, color: "#78716c", textTransform: "uppercase" },
  summaryValue: { fontSize: 14, fontWeight: 700, marginTop: 2 },
  resultPass: { color: "#15803d" },
  resultFail: { color: "#b91c1c" },

  coHeading: { marginTop: 14, marginBottom: 4, fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: "#57534e" },
  coGrid: { flexDirection: "row", flexWrap: "wrap" },
  coItem: {
    width: "32%",
    flexDirection: "row",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#e7e5e4",
    borderRadius: 3,
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginBottom: 4,
    marginRight: "1%",
  },
  coName: { fontSize: 8 },
  coGrade: { fontSize: 8, fontWeight: 700 },

  sigRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 44 },
  sigBox: { width: 150, borderTopWidth: 1, borderTopColor: "#78716c", paddingTop: 4, fontSize: 8, textAlign: "center" },
});

function fmt(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

export function ResultCardPdf({ data, logoDataUrl }: { data: ResultCardData; logoDataUrl: string }) {
  const passed = data.percent >= 33;
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

        <Text style={styles.title}>
          REPORT CARD{data.termLabel ? ` · ${data.termLabel}` : ""} · {data.academicYear}
        </Text>

        <View style={styles.grid}>
          <Field label="Student Name" value={data.student.full_name} />
          <Field label="Class & Section" value={`${data.className} · ${data.section}`} />
          <Field label="Admission No." value={data.student.admission_no ?? "—"} />
          <Field label="Father's Name" value={data.student.father_name ?? "—"} />
          <Field label="Mother's Name" value={data.student.mother_name ?? "—"} />
        </View>

        <View style={styles.table}>
          <View style={styles.thead}>
            <Text style={[styles.th, styles.subjectCell]}>Subject</Text>
            {data.exams.map((e) => (
              <Text key={e.key} style={[styles.th, styles.examCell]}>
                {e.short}{"\n"}({e.max})
              </Text>
            ))}
            <Text style={[styles.th, styles.totalCell]}>Total{"\n"}(/{schemeMax(data.exams)})</Text>
            <Text style={[styles.th, styles.gradeCell]}>Grade</Text>
          </View>

          {data.subjects.map((s, i) => (
            <View key={s.subjectId} style={[styles.tr, i % 2 ? styles.trAlt : {}]}>
              <Text style={[styles.td, styles.subjectCell]}>{s.name}</Text>
              {data.exams.map((e) => (
                <Text key={e.key} style={[styles.td, styles.examCell]}>
                  {fmt(s.obtained[e.key])}
                </Text>
              ))}
              <Text style={[styles.td, styles.totalCell]}>
                {fmt(s.total)}/{s.max || 0}
              </Text>
              <Text style={[styles.td, styles.gradeCell]}>
                {s.max ? gradeFor(s.percent) : "—"}
              </Text>
            </View>
          ))}

          <View style={styles.footRow}>
            <Text style={styles.footLabel}>Grand Total</Text>
            {data.exams.map((e) => (
              <Text key={e.key} style={[styles.td, styles.examCell, { fontWeight: 700 }]}>
                {fmt(examColumnTotal(data.subjects, e.key))}
              </Text>
            ))}
            <Text style={[styles.td, styles.totalCell]}>
              {fmt(data.total)}/{data.max}
            </Text>
            <Text style={[styles.td, styles.gradeCell]} />
          </View>
        </View>

        <View style={styles.summaryRow}>
          <Summary label="Total Marks" value={`${fmt(data.total)} / ${data.max}`} />
          <Summary label="Percentage" value={`${data.percent.toFixed(2)}%`} />
          <Summary label="Grade" value={gradeFor(data.percent)} />
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Result</Text>
            <Text style={[styles.summaryValue, passed ? styles.resultPass : styles.resultFail]}>
              {passed ? "PASS" : "FAIL"}
            </Text>
          </View>
        </View>

        {data.coCurricular.length > 0 && (
          <>
            <Text style={styles.coHeading}>Co-Curricular</Text>
            <View style={styles.coGrid}>
              {data.coCurricular.map((c) => (
                <View key={c.name} style={styles.coItem}>
                  <Text style={styles.coName}>{c.name}</Text>
                  <Text style={styles.coGrade}>{c.grade ?? "—"}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <Text style={{ fontSize: 7, color: "#78716c", marginTop: 8 }}>
          Pass mark per subject is {Math.round(0.33 * 100)}% of its total (e.g. {passMark(100)}/100).
          Grades: A1 ≥91, A2 ≥81, B1 ≥71, B2 ≥61, C1 ≥51, C2 ≥41, D ≥33, E below.
        </Text>

        <View style={styles.sigRow}>
          <Text style={styles.sigBox}>Class Teacher</Text>
          <Text style={styles.sigBox}>Examiner</Text>
          <Text style={styles.sigBox}>Principal</Text>
        </View>
      </Page>
    </Document>
  );
}

function schemeMax(exams: Exam[]): number {
  return exams.reduce((a, e) => a + e.max, 0);
}

function examColumnTotal(subjects: SubjectResult[], key: ExamKey) {
  let total = 0;
  let any = false;
  for (const s of subjects) {
    const v = s.obtained[key];
    if (v !== null && v !== undefined) {
      total += v;
      any = true;
    }
  }
  return any ? total : null;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryBox}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}
