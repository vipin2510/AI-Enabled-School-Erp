/**
 * Renders the Pathshala ERP visiting card as a 2-page PDF (page 1 = front,
 * page 2 = back) sized to exactly 3.5 × 2 inches (252 × 144 pt). The
 * graduation-cap mark mirrors the Pathshala School Management Solutions
 * brochure; module list is drawn from the same source.
 *
 *   npx tsx scripts/build-visiting-card-pdf.tsx
 *
 * Output: pathshala-visiting-card.pdf in the repo root.
 */
import * as path from "path";
import {
  renderToFile,
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Polygon,
  Line,
  Circle,
} from "@react-pdf/renderer";
import * as React from "react";

const OUT_PATH = path.resolve(__dirname, "..", "pathshala-visiting-card.pdf");

// 3.5 × 2 in at 72 pt/in = 252 × 144 pt.
const CARD_SIZE: [number, number] = [252, 144];

const COLOR = {
  bg: "#f7f8fb",
  navy: "#0b1b3d",
  navySoft: "#16284f",
  navyEdge: "#1f3464",
  text: "#0b1b3d",
  muted: "#5b6480",
  mutedSoft: "#9aa4be",
  divider: "#dde2ee",
  white: "#ffffff",
  accent: "#ea580c",
  accent2: "#fb923c",
} as const;

const s = StyleSheet.create({
  // ── Front ───────────────────────────────────────────────────────────
  front: {
    backgroundColor: COLOR.bg,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    height: "100%",
  },
  topStripe: {
    height: 3,
    width: "100%",
    flexDirection: "row",
    marginBottom: 6,
  },
  topStripeNavy: { flex: 1, backgroundColor: COLOR.navy },
  topStripeAccent: { width: 60, backgroundColor: COLOR.accent },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  headerText: {
    flexDirection: "column",
    marginLeft: 8,
  },
  brandSmall: {
    fontFamily: "Times-Bold",
    fontSize: 15,
    color: COLOR.navy,
    letterSpacing: 0.2,
    lineHeight: 1,
  },
  brandSmallDot: { color: COLOR.accent },
  brandEyebrow: {
    fontSize: 6.5,
    letterSpacing: 1.6,
    color: COLOR.muted,
    fontFamily: "Helvetica-Bold",
    marginTop: 3,
  },

  hero: {
    marginBottom: 4,
  },
  brandName: {
    fontFamily: "Times-Bold",
    fontSize: 24,
    color: COLOR.navy,
    letterSpacing: -0.3,
    lineHeight: 1,
  },
  brandUnderline: {
    width: 26,
    height: 2,
    backgroundColor: COLOR.accent,
    marginTop: 4,
  },
  brandTagline: {
    marginTop: 3,
    fontSize: 5.8,
    color: COLOR.muted,
    letterSpacing: 0.4,
    fontFamily: "Helvetica-Bold",
  },
  taglineDot: { color: COLOR.accent, fontFamily: "Helvetica-Bold" },

  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderTopWidth: 0.6,
    borderTopColor: COLOR.divider,
    paddingTop: 5,
    marginTop: "auto",
  },
  phoneCol: { flexDirection: "column" },
  phoneLabel: {
    fontSize: 5.5,
    letterSpacing: 1,
    color: COLOR.mutedSoft,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 1,
  },
  phoneIcon: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLOR.accent,
    color: COLOR.white,
    textAlign: "center",
    paddingTop: 1.2,
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    marginRight: 5,
  },
  phoneText: {
    fontSize: 9.5,
    color: COLOR.text,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.3,
  },
  webCol: {
    flexDirection: "column",
    alignItems: "flex-end",
  },
  webEyebrow: {
    fontSize: 5.5,
    letterSpacing: 1,
    color: COLOR.mutedSoft,
    fontFamily: "Helvetica-Bold",
  },
  webText: {
    fontSize: 8.5,
    color: COLOR.text,
    fontFamily: "Helvetica-Bold",
    marginTop: 1,
    letterSpacing: 0.2,
  },

  // ── Back ────────────────────────────────────────────────────────────
  back: {
    backgroundColor: COLOR.navy,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 9,
    height: "100%",
  },
  backTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  backMarkRow: { flexDirection: "row", alignItems: "center" },
  backMark: {
    fontFamily: "Times-Bold",
    fontSize: 13,
    color: COLOR.white,
    letterSpacing: 0.2,
    marginLeft: 5,
  },
  backMarkDot: { color: COLOR.accent2 },
  backEyebrow: {
    fontSize: 6.5,
    letterSpacing: 1.6,
    color: COLOR.mutedSoft,
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
    lineHeight: 1.3,
  },

  backHeadline: {
    fontFamily: "Times-Bold",
    fontSize: 10.5,
    color: COLOR.white,
    lineHeight: 1.2,
    letterSpacing: 0.1,
    marginBottom: 5,
  },
  backHeadlineAccent: {
    color: COLOR.accent2,
    fontFamily: "Times-BoldItalic",
  },

  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 6,
  },
  pill: {
    fontSize: 6,
    letterSpacing: 0.5,
    color: COLOR.white,
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 4.5,
    paddingVertical: 2,
    borderRadius: 2,
    borderWidth: 0.4,
    borderColor: COLOR.navyEdge,
    backgroundColor: COLOR.navySoft,
    marginRight: 3,
    marginBottom: 3,
  },

  backFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 0.4,
    borderTopColor: COLOR.navyEdge,
    paddingTop: 4,
    marginTop: "auto",
  },
  backPhone: {
    fontSize: 7,
    color: COLOR.white,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.3,
  },
  backPhoneAccent: { color: COLOR.accent2 },
  backWeb: {
    fontSize: 7,
    color: COLOR.mutedSoft,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.3,
    marginLeft: 8,
  },
  backStripe: {
    height: 2,
    backgroundColor: COLOR.accent,
    marginTop: 4,
    marginHorizontal: -14,
  },
});

// ── Graduation-cap mark (matches the brochure's logo silhouette) ─────────
function CapLogo({ size = 26, fill, accent }: { size?: number; fill: string; accent: string }) {
  // viewBox is 32 × 26; we scale to `size` for height.
  const h = size;
  const w = (size * 32) / 26;
  return (
    <Svg width={w} height={h} viewBox="0 0 32 26">
      {/* Mortarboard plate (perspective diamond) */}
      <Polygon points="16,2 30,9 16,16 2,9" fill={fill} />
      {/* Cap body — narrower under the plate so the plate reads as a flat top */}
      <Polygon points="10,12 22,12 22,21 10,21" fill={fill} />
      {/* Tassel string from the right corner of the plate */}
      <Line x1="30" y1="9" x2="30" y2="22" stroke={accent} strokeWidth={1.5} />
      {/* Tassel ball */}
      <Circle cx="30" cy="23" r={1.8} fill={accent} />
    </Svg>
  );
}

const MODULES = [
  "STUDENT",
  "FEES",
  "HOSTEL",
  "TRANSPORT",
  "ACADEMICS",
  "LMS",
  "GRADEBOOK",
  "HR & PAYROLL",
  "INVENTORY",
  "CERTIFICATES",
  "VISITOR",
  "CANTEEN",
  "PARENT APP",
  "SMS · WHATSAPP",
];

function Front() {
  return (
    <View style={s.front}>
      <View style={s.topStripe}>
        <View style={s.topStripeNavy} />
        <View style={s.topStripeAccent} />
      </View>

      <View style={s.header}>
        <CapLogo size={20} fill={COLOR.navy} accent={COLOR.accent} />
        <View style={s.headerText}>
          <Text style={s.brandSmall}>
            Pathshala<Text style={s.brandSmallDot}>.</Text>
          </Text>
          <Text style={s.brandEyebrow}>SCHOOL MANAGEMENT SOLUTIONS</Text>
        </View>
      </View>

      <View style={s.hero}>
        <Text style={s.brandName}>PATHSHALA</Text>
        <View style={s.brandUnderline} />
        <Text style={s.brandTagline}>
          SMART MANAGEMENT <Text style={s.taglineDot}>·</Text> BETTER EDUCATION{" "}
          <Text style={s.taglineDot}>·</Text> BRIGHTER FUTURE
        </Text>
      </View>

      <View style={s.footer}>
        <View style={s.phoneCol}>
          <Text style={s.phoneLabel}>CALL / WHATSAPP</Text>
          <View style={s.phoneRow}>
            <Text style={s.phoneIcon}>✆</Text>
            <Text style={s.phoneText}>+91 91110 12558</Text>
          </View>
          <View style={s.phoneRow}>
            <Text style={s.phoneIcon}>✆</Text>
            <Text style={s.phoneText}>+91 75874 32300</Text>
          </View>
        </View>
        <View style={s.webCol}>
          <Text style={s.webEyebrow}>VISIT</Text>
          <Text style={s.webText}>pathshala-erp-solutions.in</Text>
        </View>
      </View>
    </View>
  );
}

function Back() {
  return (
    <View style={s.back}>
      <View style={s.backTop}>
        <View style={s.backMarkRow}>
          <CapLogo size={16} fill={COLOR.white} accent={COLOR.accent2} />
          <Text style={s.backMark}>
            Pathshala<Text style={s.backMarkDot}>.</Text>
          </Text>
        </View>
        <Text style={s.backEyebrow}>30+ MODULES{"\n"}ONE PLATFORM</Text>
      </View>

      <Text style={s.backHeadline}>
        Run your school.{" "}
        <Text style={s.backHeadlineAccent}>Without the paperwork.</Text>
      </Text>

      <View style={s.pillRow}>
        {MODULES.map((m) => (
          <Text key={m} style={s.pill}>
            {m}
          </Text>
        ))}
      </View>

      <View style={s.backFooter}>
        <Text style={s.backPhone}>
          <Text style={s.backPhoneAccent}>✆</Text> +91 91110 12558 · +91 75874 32300
        </Text>
        <Text style={s.backWeb}>pathshala-erp-solutions.in</Text>
      </View>

      <View style={s.backStripe} />
    </View>
  );
}

const Doc = (
  <Document
    title="Pathshala ERP — Visiting Card"
    author="Pathshala School Management Solutions"
    subject="3.5 x 2 inch visiting card, front & back"
  >
    <Page size={CARD_SIZE} style={{ padding: 0, backgroundColor: COLOR.white }}>
      <Front />
    </Page>
    <Page size={CARD_SIZE} style={{ padding: 0, backgroundColor: COLOR.white }}>
      <Back />
    </Page>
  </Document>
);

async function main() {
  await renderToFile(Doc, OUT_PATH);
  console.log(`Wrote ${OUT_PATH}`);
}
main();
