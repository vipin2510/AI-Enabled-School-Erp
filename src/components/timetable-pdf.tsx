/* eslint-disable jsx-a11y/alt-text */
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import type { Timetable } from "@/lib/timetable";

export type TimetableMeta = {
  className: string;
  schoolName: string;
  schoolLocation: string;
  schoolParentNote?: string | null;
  academicYear: string;
};

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
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  metaCell: { fontSize: 8 },
  metaLabel: { color: "#78716c", fontSize: 7, textTransform: "uppercase" },

  table: { borderWidth: 1, borderColor: "#d6d3d1", borderRadius: 3, overflow: "hidden" },
  thead: { flexDirection: "row", backgroundColor: "#0f172a" },
  th: { padding: 4, fontWeight: 700, fontSize: 7.5, color: "#ffffff", textAlign: "center" },
  tr: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#e7e5e4" },
  trAlt: { backgroundColor: "#fafaf9" },
  td: { padding: 4, fontSize: 7.5, textAlign: "center" },

  dayCell: { width: 38, fontWeight: 700, justifyContent: "center" },
  periodCell: { flex: 1, justifyContent: "center" },
  lunchRow: {
    flexDirection: "row",
    backgroundColor: "#fef3c7",
    borderTopWidth: 1,
    borderTopColor: "#e7e5e4",
    paddingVertical: 4,
    justifyContent: "center",
  },
  lunchText: { fontSize: 7.5, fontWeight: 700, color: "#92400e", letterSpacing: 1 },

  subjectName: { fontWeight: 700 },
  teacherName: { fontSize: 6.5, color: "#57534e", marginTop: 1 },
  freeText: { color: "#a8a29e", fontStyle: "italic" },

  legend: { marginTop: 12, fontSize: 7, color: "#57534e" },
  sigRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 28 },
  sigBox: {
    width: 140,
    borderTopWidth: 1,
    borderTopColor: "#78716c",
    paddingTop: 3,
    fontSize: 7.5,
    textAlign: "center",
  },
});

function timeRange(start: string, end: string): string {
  return `${start}\n–\n${end}`;
}

export function TimetablePdf({
  meta,
  timetable,
  logoDataUrl,
}: {
  meta: TimetableMeta;
  timetable: Timetable;
  logoDataUrl: string;
}) {
  const { slots, lunchSlot, days, grid } = timetable;
  // Insert the lunch column between morning and afternoon periods so the
  // printout matches the on-screen grid.
  const renderRow = (dayIndex: number, label: string, alt: boolean) => {
    const cells: React.ReactNode[] = [];
    cells.push(
      <View key="day" style={[styles.td, styles.dayCell]}>
        <Text>{label}</Text>
      </View>
    );
    for (const slot of slots) {
      const cell = grid[dayIndex][slot.index - 1];
      cells.push(
        <View key={`p-${slot.index}`} style={[styles.td, styles.periodCell]}>
          {"free" in cell ? (
            <Text style={styles.freeText}>Free</Text>
          ) : (
            <>
              <Text style={styles.subjectName}>{cell.subject}</Text>
              {cell.teacher ? <Text style={styles.teacherName}>{cell.teacher}</Text> : null}
            </>
          )}
        </View>
      );
    }
    return (
      <View key={`row-${dayIndex}`} style={[styles.tr, alt ? styles.trAlt : {}]}>
        {cells}
      </View>
    );
  };

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.headerRow}>
          <Image src={logoDataUrl} style={styles.logo} />
          <View>
            <Text style={styles.schoolName}>{meta.schoolName.toUpperCase()}</Text>
            <Text style={styles.schoolSub}>{meta.schoolLocation}</Text>
            {meta.schoolParentNote ? (
              <Text style={styles.schoolSub}>{meta.schoolParentNote}</Text>
            ) : null}
          </View>
        </View>

        <Text style={styles.title}>
          CLASS TIMETABLE · {meta.className.toUpperCase()} · {meta.academicYear}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Variant</Text>
            <Text style={{ fontWeight: 700 }}>{timetable.label}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Days / week</Text>
            <Text style={{ fontWeight: 700 }}>{days.length}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Periods / day</Text>
            <Text style={{ fontWeight: 700 }}>{slots.length}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>First bell</Text>
            <Text style={{ fontWeight: 700 }}>{slots[0]?.startTime ?? "—"}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Lunch</Text>
            <Text style={{ fontWeight: 700 }}>
              {lunchSlot ? `${lunchSlot.startTime} – ${lunchSlot.endTime}` : "—"}
            </Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.thead}>
            <Text style={[styles.th, styles.dayCell]}>Day</Text>
            {slots.map((s) => (
              <Text key={s.index} style={[styles.th, styles.periodCell]}>
                P{s.index}{"\n"}
                {timeRange(s.startTime, s.endTime)}
              </Text>
            ))}
          </View>

          {days.map((d, di) => renderRow(di, d, di % 2 === 1))}

          {lunchSlot ? (
            <View style={styles.lunchRow}>
              <Text style={styles.lunchText}>
                LUNCH BREAK · {lunchSlot.startTime} – {lunchSlot.endTime}
              </Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.legend}>
          Generated by Pathshala ERP. This timetable is a suggestion — adjust manually before pinning to the noticeboard.
        </Text>

        <View style={styles.sigRow}>
          <Text style={styles.sigBox}>Class Teacher</Text>
          <Text style={styles.sigBox}>Academic Coordinator</Text>
          <Text style={styles.sigBox}>Principal</Text>
        </View>
      </Page>
    </Document>
  );
}
