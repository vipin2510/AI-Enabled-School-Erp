import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

// Fixed school marksheet — a wide landscape grid: each subject scored across
// four Unit Tests and three Terminal Examinations, plus a weighted Aggregate
// block (UT 20% + Terminal I&II 30% + Terminal III 50%). Everything below the
// subject table (grand total, percentage, dictation/handwriting, grades,
// rank, result, attendance days …) is a `GenericRow` the route fills, so this
// component stays a dumb renderer of one fixed layout.

export type SubjectRow = {
  name: string;
  utMax: number;
  utMin: number;
  terminalMax: number;
  ut: (number | null)[]; // [ut1, ut2, ut3, ut4]
  utTotal: number | null;
  terminal: (number | null)[]; // [t1, t2, t3]
  agg: { ut: number; iII: number; iii: number; total: number };
};

// A row in the block below the subjects. Any cell may be null/blank. `maxCell`
// spans the Max+Min columns (used by the extra-assessment rows that carry a
// single max, e.g. "English Dictation / 10").
export type GenericRow = {
  label: string;
  bold?: boolean;
  // Either a single spanning Max cell (extras, e.g. "10"), or explicit UT
  // Max/Min cells (the GRAND TOTAL row). If neither is set, both are blank.
  maxCell?: string | null;
  utMaxCell?: string | number | null;
  utMinCell?: string | number | null;
  tMaxCell?: string | number | null; // explicit Terminal Max (GRAND TOTAL)
  ut?: (string | number | null)[]; // up to 4
  utTotal?: string | number | null;
  terminal?: (string | number | null)[]; // up to 3
  agg?: (string | number | null)[]; // up to 4 (UT, I+II, III, Total)
};

export type MarksheetData = {
  schoolName: string;
  academicYear: string;
  className: string;
  section: string;
  studentName: string;
  subjects: SubjectRow[];
  rows: GenericRow[];
};

// Back-compat alias — the route used to pass `ResultCardData`.
export type ResultCardData = MarksheetData;

// 17 columns. Flex weights tuned so the subject name is wide and the score
// columns stay legible on A4 landscape.
const F = {
  name: 3.4,
  utMax: 0.9,
  utMin: 0.9,
  ut: 0.82,
  utTotal: 0.95,
  tMax: 0.9,
  tMin: 0.9,
  t: 0.95,
  agg: 0.92,
};
const UT_BLOCK = F.utMax + F.utMin + F.ut * 4 + F.utTotal;
const T_BLOCK = F.tMax + F.tMin + F.t * 3;
const AGG_BLOCK = F.agg * 4;

const styles = StyleSheet.create({
  page: { padding: 18, fontSize: 7.5, fontFamily: "Helvetica", color: "#111827" },
  outer: { borderWidth: 1, borderColor: "#111827" },

  titleRow: {
    flexDirection: "row",
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#111827",
    paddingVertical: 4,
  },
  title: { fontSize: 11, fontWeight: 700, letterSpacing: 0.3 },

  infoRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#111827" },
  nameCell: {
    flexGrow: 1,
    flexBasis: 0,
    paddingHorizontal: 6,
    paddingVertical: 5,
    fontSize: 9,
    fontWeight: 700,
    borderRightWidth: 1,
    borderRightColor: "#111827",
  },
  classCell: { width: 150, paddingHorizontal: 6, paddingVertical: 5, fontSize: 11, fontWeight: 700 },

  row: { flexDirection: "row", alignItems: "stretch" },
  cell: {
    borderRightWidth: 1,
    borderRightColor: "#111827",
    borderBottomWidth: 1,
    borderBottomColor: "#111827",
    paddingVertical: 2.5,
    paddingHorizontal: 2,
    textAlign: "center",
    justifyContent: "center",
  },
  headCell: { backgroundColor: "#f3f4f6", fontWeight: 700, fontSize: 6.8 },
  groupCell: { backgroundColor: "#e5e7eb", fontWeight: 700, fontSize: 8, letterSpacing: 0.3 },
  nameColCell: { textAlign: "left", paddingLeft: 5 },
  bold: { fontWeight: 700 },

  sigRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 18, paddingHorizontal: 8 },
  sig: { fontSize: 8, fontWeight: 700 },
});

function fmt(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "string") return v;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

// One table cell.
function Cell({
  children,
  flex,
  style,
}: {
  children?: React.ReactNode;
  flex: number;
  style?: object;
}) {
  return (
    <View style={[styles.cell, { flexGrow: flex, flexBasis: 0 }, style ?? {}] as never}>
      <Text>{children}</Text>
    </View>
  );
}

export function ResultCardPdf({ data }: { data: MarksheetData; logoDataUrl?: string }) {
  const subjFlexes = [
    F.utMax, F.utMin, F.ut, F.ut, F.ut, F.ut, F.utTotal,
    F.tMax, F.tMin, F.t, F.t, F.t,
    F.agg, F.agg, F.agg, F.agg,
  ];

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.outer}>
          {/* School title */}
          <View style={styles.titleRow}>
            <Text style={styles.title}>
              {data.schoolName}  {data.academicYear}
            </Text>
          </View>

          {/* Name + Class */}
          <View style={styles.infoRow}>
            <Text style={styles.nameCell}>NAME : {data.studentName}</Text>
            <Text style={styles.classCell}>
              CLASS : {data.className} {data.section ? `'${data.section}'` : ""}
            </Text>
          </View>

          {/* Group header */}
          <View style={styles.row}>
            <Cell flex={F.name} style={[styles.groupCell, styles.nameColCell]}>MAIN SUBJECT</Cell>
            <Cell flex={UT_BLOCK} style={styles.groupCell}>UNIT-TEST {data.academicYear}</Cell>
            <Cell flex={T_BLOCK} style={styles.groupCell}>TERMINAL EXAMINATION</Cell>
            <Cell flex={AGG_BLOCK} style={[styles.groupCell, { borderRightWidth: 0 }]}>AGGREGATE</Cell>
          </View>

          {/* Sub header */}
          <View style={styles.row}>
            <Cell flex={F.name} style={[styles.headCell, styles.nameColCell]}> </Cell>
            <Cell flex={F.utMax} style={styles.headCell}>Max{"\n"}Marks</Cell>
            <Cell flex={F.utMin} style={styles.headCell}>Min{"\n"}Marks</Cell>
            <Cell flex={F.ut} style={styles.headCell}>I</Cell>
            <Cell flex={F.ut} style={styles.headCell}>II</Cell>
            <Cell flex={F.ut} style={styles.headCell}>III</Cell>
            <Cell flex={F.ut} style={styles.headCell}>IV</Cell>
            <Cell flex={F.utTotal} style={styles.headCell}>UT{"\n"}TOTAL</Cell>
            <Cell flex={F.tMax} style={styles.headCell}>Max{"\n"}Marks</Cell>
            <Cell flex={F.tMin} style={styles.headCell}>Min{"\n"}Marks</Cell>
            <Cell flex={F.t} style={styles.headCell}>I</Cell>
            <Cell flex={F.t} style={styles.headCell}>II</Cell>
            <Cell flex={F.t} style={styles.headCell}>III</Cell>
            <Cell flex={F.agg} style={styles.headCell}>UT{"\n"}20%</Cell>
            <Cell flex={F.agg} style={styles.headCell}>I+II{"\n"}30%</Cell>
            <Cell flex={F.agg} style={styles.headCell}>III{"\n"}50%</Cell>
            <Cell flex={F.agg} style={[styles.headCell, { borderRightWidth: 0 }]}>TOTAL{"\n"}100%</Cell>
          </View>

          {/* Subject rows */}
          {data.subjects.map((s, i) => {
            const cells = [
              fmt(s.utMax), fmt(s.utMin),
              fmt(s.ut[0]), fmt(s.ut[1]), fmt(s.ut[2]), fmt(s.ut[3]), fmt(s.utTotal),
              fmt(s.terminalMax), "",
              fmt(s.terminal[0]), fmt(s.terminal[1]), fmt(s.terminal[2]),
              fmt(s.agg.ut), fmt(s.agg.iII), fmt(s.agg.iii), fmt(s.agg.total),
            ];
            return (
              <View key={i} style={styles.row}>
                <Cell flex={F.name} style={[styles.nameColCell, styles.bold]}>{s.name}</Cell>
                {cells.map((c, j) => (
                  <Cell key={j} flex={subjFlexes[j]} style={j === cells.length - 1 ? { borderRightWidth: 0 } : {}}>
                    {c}
                  </Cell>
                ))}
              </View>
            );
          })}

          {/* Generic rows below the subjects */}
          {data.rows.map((r, i) => (
            <GenericRowView key={i} row={r} />
          ))}
        </View>

        {/* Signatures */}
        <View style={styles.sigRow}>
          <Text style={styles.sig}>Signature of Class Teacher</Text>
          <Text style={styles.sig}>Signature of Examination Incharge</Text>
          <Text style={styles.sig}>Signature of Principal</Text>
        </View>
      </Page>
    </Document>
  );
}

function GenericRowView({ row }: { row: GenericRow }) {
  const ut = row.ut ?? [];
  const terminal = row.terminal ?? [];
  const agg = row.agg ?? [];
  const cellStyle = row.bold ? styles.bold : {};
  return (
    <View style={styles.row}>
      <Cell flex={F.name} style={[styles.nameColCell, cellStyle]}>{row.label}</Cell>
      {/* Max/Min area — a single spanning cell when the row carries a max. */}
      {row.maxCell !== undefined ? (
        <Cell flex={F.utMax + F.utMin} style={cellStyle}>{fmt(row.maxCell)}</Cell>
      ) : (
        <>
          <Cell flex={F.utMax} style={cellStyle}>{fmt(row.utMaxCell)}</Cell>
          <Cell flex={F.utMin} style={cellStyle}>{fmt(row.utMinCell)}</Cell>
        </>
      )}
      <Cell flex={F.ut} style={cellStyle}>{fmt(ut[0])}</Cell>
      <Cell flex={F.ut} style={cellStyle}>{fmt(ut[1])}</Cell>
      <Cell flex={F.ut} style={cellStyle}>{fmt(ut[2])}</Cell>
      <Cell flex={F.ut} style={cellStyle}>{fmt(ut[3])}</Cell>
      <Cell flex={F.utTotal} style={cellStyle}>{fmt(row.utTotal)}</Cell>
      <Cell flex={F.tMax} style={cellStyle}>{fmt(row.tMaxCell)}</Cell>
      <Cell flex={F.tMin} style={cellStyle}>{""}</Cell>
      <Cell flex={F.t} style={cellStyle}>{fmt(terminal[0])}</Cell>
      <Cell flex={F.t} style={cellStyle}>{fmt(terminal[1])}</Cell>
      <Cell flex={F.t} style={cellStyle}>{fmt(terminal[2])}</Cell>
      <Cell flex={F.agg} style={cellStyle}>{fmt(agg[0])}</Cell>
      <Cell flex={F.agg} style={cellStyle}>{fmt(agg[1])}</Cell>
      <Cell flex={F.agg} style={cellStyle}>{fmt(agg[2])}</Cell>
      <Cell flex={F.agg} style={[cellStyle, { borderRightWidth: 0 }]}>{fmt(agg[3])}</Cell>
    </View>
  );
}
