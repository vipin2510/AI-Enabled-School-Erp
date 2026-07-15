/* eslint-disable jsx-a11y/alt-text */
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { periodsForDay, MAX_PERIOD } from "@/lib/timetable";

export type TimetableMeta = {
  title: string; // e.g. class name or teacher name
  schoolName: string;
  schoolLocation: string;
  schoolParentNote?: string | null;
  academicYear: string;
};

export type Day = { n: number; name: string; full: string };

// key `${day}-${period}` → cell content
export type ClassCell = { subject: string; teacher: string };
export type ClassGrid = Record<string, ClassCell>;
// teacher view: a slot can hold more than one class (scheduling conflicts show up)
export type TeacherGrid = Record<string, string[]>;

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 8, fontFamily: "Helvetica", color: "#1c1917" },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 1.5,
    borderBottomColor: "#0f172a",
    paddingBottom: 8,
    marginBottom: 10,
    alignItems: "center",
  },
  logo: { width: 46, height: 46, marginRight: 12 },
  schoolName: { fontSize: 15, fontWeight: 700 },
  schoolSub: { fontSize: 7, color: "#57534e" },

  title: {
    textAlign: "center",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1,
    backgroundColor: "#f5f5f4",
    paddingVertical: 4,
    marginBottom: 10,
    borderRadius: 3,
  },

  table: { borderWidth: 1, borderColor: "#d6d3d1", borderRadius: 3, overflow: "hidden" },
  thead: { flexDirection: "row", backgroundColor: "#0f172a" },
  th: { padding: 4, fontWeight: 700, fontSize: 7.5, color: "#ffffff", textAlign: "center" },
  tr: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#e7e5e4" },
  trAlt: { backgroundColor: "#fafaf9" },
  td: { padding: 4, fontSize: 7.5, textAlign: "center", justifyContent: "center" },

  dayCell: { width: 60, fontWeight: 700, justifyContent: "center", textAlign: "left" },
  periodCell: { flex: 1, justifyContent: "center" },
  ctCell: { flex: 1, justifyContent: "center", backgroundColor: "#ecfdf5" },
  offCell: { flex: 1, justifyContent: "center", backgroundColor: "#f5f5f4" },

  subjectName: { fontWeight: 700 },
  teacherName: { fontSize: 6.5, color: "#57534e", marginTop: 1 },
  ctLabel: { fontSize: 6.5, fontWeight: 700, color: "#065f46" },
  freeText: { color: "#a8a29e" },

  legend: { marginTop: 12, fontSize: 7, color: "#57534e" },
  sigRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 24 },
  sigBox: { width: 150, alignItems: "center" },
  sigImg: { height: 30, marginBottom: 2, objectFit: "contain" },
  sigLine: {
    width: 150,
    borderTopWidth: 1,
    borderTopColor: "#78716c",
    paddingTop: 3,
    fontSize: 7.5,
    textAlign: "center",
  },
});

function Header({ meta, logoDataUrl }: { meta: TimetableMeta; logoDataUrl: string }) {
  return (
    <View style={styles.headerRow}>
      <Image src={logoDataUrl} style={styles.logo} />
      <View>
        <Text style={styles.schoolName}>{meta.schoolName.toUpperCase()}</Text>
        <Text style={styles.schoolSub}>{meta.schoolLocation}</Text>
        {meta.schoolParentNote ? <Text style={styles.schoolSub}>{meta.schoolParentNote}</Text> : null}
      </View>
    </View>
  );
}

function PeriodHead() {
  const periods = Array.from({ length: MAX_PERIOD }, (_, i) => i + 1);
  return (
    <View style={styles.thead}>
      <Text style={[styles.th, styles.dayCell]}>Day</Text>
      {periods.map((p) => (
        <Text key={p} style={[styles.th, styles.periodCell]}>
          P{p}
          {p === 1 ? "\n(CT)" : ""}
        </Text>
      ))}
    </View>
  );
}

export function ClassTimetablePdf({
  meta,
  days,
  grid,
  classTeacherName,
  logoDataUrl,
  classTeacherSignatureUrl,
  principalSignatureUrl,
}: {
  meta: TimetableMeta;
  days: Day[];
  grid: ClassGrid;
  classTeacherName: string | null;
  logoDataUrl: string;
  classTeacherSignatureUrl?: string | null;
  principalSignatureUrl?: string | null;
}) {
  const periods = Array.from({ length: MAX_PERIOD }, (_, i) => i + 1);
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Header meta={meta} logoDataUrl={logoDataUrl} />
        <Text style={styles.title}>
          CLASS TIMETABLE · {meta.title.toUpperCase()} · {meta.academicYear}
        </Text>

        <View style={styles.table}>
          <PeriodHead />
          {days.map((d, di) => (
            <View key={d.n} style={[styles.tr, di % 2 === 1 ? styles.trAlt : {}]}>
              <View style={[styles.td, styles.dayCell]}>
                <Text>{d.full}</Text>
              </View>
              {periods.map((p) => {
                if (p === 1) {
                  return (
                    <View key={p} style={[styles.td, styles.ctCell]}>
                      <Text style={styles.ctLabel}>Class Teacher</Text>
                      {classTeacherName ? <Text style={styles.teacherName}>{classTeacherName}</Text> : null}
                    </View>
                  );
                }
                if (p > periodsForDay(d.n)) {
                  return <View key={p} style={[styles.td, styles.offCell]} />;
                }
                const cell = grid[`${d.n}-${p}`];
                return (
                  <View key={p} style={[styles.td, styles.periodCell]}>
                    {cell && (cell.subject || cell.teacher) ? (
                      <>
                        {cell.subject ? <Text style={styles.subjectName}>{cell.subject}</Text> : null}
                        {cell.teacher ? <Text style={styles.teacherName}>{cell.teacher}</Text> : null}
                      </>
                    ) : (
                      <Text style={styles.freeText}>—</Text>
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        <View style={styles.sigRow}>
          <View style={styles.sigBox}>
            {classTeacherSignatureUrl ? <Image src={classTeacherSignatureUrl} style={styles.sigImg} /> : null}
            <Text style={styles.sigLine}>Class Teacher{classTeacherName ? ` · ${classTeacherName}` : ""}</Text>
          </View>
          <View style={styles.sigBox}>
            <Text style={styles.sigLine}>Academic Coordinator</Text>
          </View>
          <View style={styles.sigBox}>
            {principalSignatureUrl ? <Image src={principalSignatureUrl} style={styles.sigImg} /> : null}
            <Text style={styles.sigLine}>Principal</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export function TeacherTimetablePdf({
  meta,
  days,
  grid,
  logoDataUrl,
}: {
  meta: TimetableMeta;
  days: Day[];
  grid: TeacherGrid;
  logoDataUrl: string;
}) {
  const periods = Array.from({ length: MAX_PERIOD }, (_, i) => i + 1);
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Header meta={meta} logoDataUrl={logoDataUrl} />
        <Text style={styles.title}>
          TEACHER TIMETABLE · {meta.title.toUpperCase()} · {meta.academicYear}
        </Text>

        <View style={styles.table}>
          <PeriodHead />
          {days.map((d, di) => (
            <View key={d.n} style={[styles.tr, di % 2 === 1 ? styles.trAlt : {}]}>
              <View style={[styles.td, styles.dayCell]}>
                <Text>{d.full}</Text>
              </View>
              {periods.map((p) => {
                if (p > periodsForDay(d.n)) {
                  return <View key={p} style={[styles.td, styles.offCell]} />;
                }
                const entries = grid[`${d.n}-${p}`] ?? [];
                return (
                  <View key={p} style={[styles.td, styles.periodCell]}>
                    {entries.length ? (
                      entries.map((e, i) => (
                        <Text key={i} style={i === 0 ? styles.subjectName : styles.teacherName}>
                          {e}
                        </Text>
                      ))
                    ) : (
                      <Text style={styles.freeText}>—</Text>
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        <Text style={styles.legend}>
          Shows this teacher&apos;s periods across every class. Period 1 (CT) entries come from
          class-teacher assignments.
        </Text>
      </Page>
    </Document>
  );
}
