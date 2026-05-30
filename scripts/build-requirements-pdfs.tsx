/**
 * Renders the three school onboarding PDFs from the markdown sources in
 * requirements/ to printable A4 documents using @react-pdf/renderer (the same
 * library the ERP uses for receipts and ID cards).
 *
 *   npm run pdfs:build
 *
 * The output PDFs are committed to the repo so the school office can print
 * straight from the folder without running anything.
 */
import * as path from "path";
import * as fs from "fs";
import { renderToFile, Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import * as React from "react";

const OUT_DIR = path.resolve(__dirname, "..", "requirements");

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#1c1917" },
  brandBar: {
    borderBottomWidth: 2,
    borderBottomColor: "#ea580c",
    paddingBottom: 8,
    marginBottom: 16,
  },
  brand: { fontSize: 10, color: "#ea580c", letterSpacing: 2, fontWeight: 700 },
  title: { fontSize: 22, fontWeight: 700, marginTop: 2 },
  subtitle: { fontSize: 11, color: "#57534e", marginTop: 4 },

  h2: { fontSize: 13, fontWeight: 700, marginTop: 16, marginBottom: 6 },
  h3: { fontSize: 11, fontWeight: 700, marginTop: 10, marginBottom: 4 },
  p: { fontSize: 10, lineHeight: 1.5, marginBottom: 6 },

  row: { flexDirection: "row", marginBottom: 4, paddingRight: 6 },
  bullet: { width: 12, fontSize: 10 },
  checkbox: { width: 14, fontSize: 12 },
  rowText: { flex: 1, fontSize: 10, lineHeight: 1.45 },

  callout: {
    backgroundColor: "#fef3c7",
    borderLeftWidth: 3,
    borderLeftColor: "#f59e0b",
    padding: 8,
    marginVertical: 8,
  },
  calloutText: { fontSize: 9, color: "#78350f", lineHeight: 1.4 },

  doBox: {
    backgroundColor: "#ecfdf5",
    borderLeftWidth: 3,
    borderLeftColor: "#10b981",
    padding: 8,
    marginTop: 8,
  },
  dontBox: {
    backgroundColor: "#fef2f2",
    borderLeftWidth: 3,
    borderLeftColor: "#ef4444",
    padding: 8,
    marginTop: 8,
  },
  boxTitle: { fontSize: 11, fontWeight: 700, marginBottom: 4 },

  mono: { fontFamily: "Courier", fontSize: 9 },
  footer: {
    position: "absolute",
    bottom: 18,
    left: 36,
    right: 36,
    fontSize: 8,
    color: "#a8a29e",
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: "#e7e5e4",
    paddingTop: 6,
  },
});

// ---------------------------------------------------------------------------
// Tiny building blocks
// ---------------------------------------------------------------------------
const Brand = ({ tag, title, subtitle }: { tag: string; title: string; subtitle?: string }) => (
  <View style={styles.brandBar}>
    <Text style={styles.brand}>{tag}</Text>
    <Text style={styles.title}>{title}</Text>
    {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
  </View>
);

const Bullet = ({ children }: { children: React.ReactNode }) => (
  <View style={styles.row}>
    <Text style={styles.bullet}>•</Text>
    <Text style={styles.rowText}>{children}</Text>
  </View>
);

const Check = ({ children }: { children: React.ReactNode }) => (
  <View style={styles.row}>
    <Text style={styles.checkbox}>☐</Text>
    <Text style={styles.rowText}>{children}</Text>
  </View>
);

const Callout = ({ children }: { children: React.ReactNode }) => (
  <View style={styles.callout}>
    <Text style={styles.calloutText}>{children}</Text>
  </View>
);

const Footer = ({ label }: { label: string }) => (
  <Text style={styles.footer} fixed render={({ pageNumber, totalPages }) =>
    `${label}   ·   Pathshala ERP · Adeshwar Public School Franchise   ·   Page ${pageNumber} of ${totalPages}`
  } />
);

// ---------------------------------------------------------------------------
// PDF 1 — Onboarding overview
// ---------------------------------------------------------------------------
const Overview = () => (
  <Document title="School Onboarding — Overview" author="Pathshala ERP">
    <Page size="A4" style={styles.page}>
      <Brand
        tag="ONBOARDING KIT"
        title="Pathshala ERP — Franchise Onboarding"
        subtitle="What's in the requirements folder, and how to use it"
      />

      <Text style={styles.p}>
        This kit brings a new Adeshwar Public School unit online in the Pathshala ERP.
        Each school is fully isolated inside the database: students, fees, attendance,
        library, results — none of it crosses school boundaries. Fill the templates,
        upload the photos, and hand the folder back to the implementation admin.
      </Text>

      <Text style={styles.h2}>What's in here</Text>
      <Bullet><Text style={styles.mono}>requirements/onboarding-overview.pdf</Text> — this document</Bullet>
      <Bullet><Text style={styles.mono}>requirements/checklist.pdf</Text> — end-to-end onboarding checklist (print one per school)</Bullet>
      <Bullet><Text style={styles.mono}>requirements/image-guide.pdf</Text> — how to host profile photos on Google Drive</Bullet>
      <Bullet><Text style={styles.mono}>requirements/01-kondagaon/</Text> — Kondagaon (main unit)</Bullet>
      <Bullet><Text style={styles.mono}>requirements/02-pharasgaon/</Text> — Pharasgaon branch</Bullet>
      <Bullet><Text style={styles.mono}>requirements/03-chipawand/</Text> — Chipawand branch</Bullet>
      <Text style={styles.p}>
        Every school folder has the same set of CSV templates with headers only — the school
        office fills the rows.
      </Text>

      <Text style={styles.h2}>Filling order</Text>
      <Text style={styles.p}>
        CSVs depend on each other (a student needs a class to exist first). Fill them
        in this exact order:
      </Text>
      <Check><Text style={{ fontWeight: 700 }}>1. classes.csv</Text> — every class the school runs (e.g. Class 1, Class 2 …)</Check>
      <Check><Text style={{ fontWeight: 700 }}>2. sections.csv</Text> — sections inside each class (A, B, C …)</Check>
      <Check><Text style={{ fontWeight: 700 }}>3. subjects.csv</Text> — subjects per class; mark co-curricular ones</Check>
      <Check><Text style={{ fontWeight: 700 }}>4. students.csv</Text> — the roster; spelling of class + section must match steps 1 & 2</Check>
      <Check><Text style={{ fontWeight: 700 }}>5. staff.csv</Text> — teachers, fees clerks, librarians, the principal</Check>
      <Check><Text style={{ fontWeight: 700 }}>6. fee-structures.csv + fee-components.csv</Text> — fee plan per class</Check>
      <Check><Text style={{ fontWeight: 700 }}>7. books.csv + library-settings.csv</Text> — library catalog (optional)</Check>

      <Text style={styles.h2}>Photos</Text>
      <Text style={styles.p}>
        Profile photos, parent photos, and ID-card photos go on Google Drive. Paste the
        sharable link into the CSV. The image-guide.pdf has the full Drive workflow,
        naming convention, and do's and don'ts.
      </Text>

      <Text style={styles.h2}>What you do NOT need to supply</Text>
      <Bullet>School name, address, board code — already coded into the ERP from the three franchise units.</Bullet>
      <Bullet>Login credentials — admin creates these from staff.csv and prints the phone+password handouts.</Bullet>
      <Bullet>Receipt and ID-card templates — generated by the ERP, not editable per school.</Bullet>

      <Callout>
        Tip: keep one copy of checklist.pdf per school as you work through the kit, and tick
        boxes as you finish. The checklist is what the implementation admin uses to verify
        the folder before importing.
      </Callout>

      <Footer label="Onboarding overview" />
    </Page>
  </Document>
);

// ---------------------------------------------------------------------------
// PDF 2 — Checklist (per school)
// ---------------------------------------------------------------------------
const Checklist = () => (
  <Document title="Onboarding Checklist" author="Pathshala ERP">
    <Page size="A4" style={styles.page}>
      <Brand
        tag="CHECKLIST"
        title="School Onboarding Checklist"
        subtitle="Print one copy per school. Tick boxes as you go."
      />

      <Text style={styles.h2}>1. School identity (verify only)</Text>
      <Check>School name, location, and board code in the ERP match your letterhead. If anything is wrong, raise it before starting data entry — fixing it later means re-issuing receipts.</Check>

      <Text style={styles.h2}>2. Classes &amp; sections</Text>
      <Check><Text style={styles.mono}>classes.csv</Text> — one row per class the school actually runs this year.</Check>
      <Check><Text style={styles.mono}>sections.csv</Text> — one row per section per class. Skip if a class has only one section.</Check>
      <Check><Text style={styles.mono}>subjects.csv</Text> — one row per subject per class. Mark co-curricular subjects (Art, Music, PT) with co_curricular = yes.</Check>

      <Text style={styles.h2}>3. Students</Text>
      <Check><Text style={styles.mono}>students.csv</Text> — one row per student.</Check>
      <Check>Admission numbers are unique and follow your existing format.</Check>
      <Check>Class and section spellings match classes.csv / sections.csv exactly.</Check>
      <Check>Mobile numbers are 10 digits, no +91, no spaces, no dashes.</Check>
      <Check>Date of birth is DD-MM-YYYY (matches CISCE registration format).</Check>
      <Check>Profile photo links pasted in profile_image_url. See image-guide.pdf.</Check>
      <Check>Father / mother photo links pasted in father_image_url and mother_image_url. Leave blank if not collected.</Check>

      <Text style={styles.h2}>4. Staff (and their logins)</Text>
      <Check><Text style={styles.mono}>staff.csv</Text> — one row per staff member who needs a login.</Check>
      <Check>Phone numbers are 10 digits and unique (this is their login username — no two staff can share a phone).</Check>
      <Check><Text style={styles.mono}>role</Text> is one of admin, manager, staff.</Check>
      <Check><Text style={styles.mono}>department</Text> filled for staff rows only (fees / academics / library / results). Leave blank for admin and manager.</Check>
      <Check><Text style={styles.mono}>initial_password</Text> is set. Each staff member is told to change it on first login.</Check>
    </Page>

    <Page size="A4" style={styles.page}>
      <Text style={styles.h2}>5. Fees</Text>
      <Check><Text style={styles.mono}>fee-structures.csv</Text> — one row per (class × academic year × scope). Scope is school or hostel.</Check>
      <Check><Text style={styles.mono}>fee-components.csv</Text> — line items inside each structure. Yearly fee, monthly fee, registration, caution, admission one-time.</Check>
      <Check>Component totals add up to the structure total amount.</Check>

      <Text style={styles.h2}>6. Library (optional — skip if not using)</Text>
      <Check><Text style={styles.mono}>books.csv</Text> — one row per copy (so a 5-copy title is 5 rows, each with its own code).</Check>
      <Check><Text style={styles.mono}>library-settings.csv</Text> — single row with the school's loan rules.</Check>

      <Text style={styles.h2}>7. Images on Drive</Text>
      <Check>All photo folders shared as "Anyone with the link can view".</Check>
      <Check>File naming follows admission number (e.g. K-2026-0142.jpg).</Check>
      <Check>No image exceeds 2 MB. Compress with tinypng.com if larger.</Check>
      <Check>The shared link in each CSV row opens the correct photo (spot-check 10 random rows).</Check>

      <Text style={styles.h2}>8. Hand-off</Text>
      <Check>All CSVs in the school's folder have data, not just headers.</Check>
      <Check>No CSV has a row where every cell is empty.</Check>
      <Check>No special characters beyond standard Hindi/English text (avoid smart-quotes from Word — paste through a plain text editor).</Check>
      <Check>Filed with the implementation admin: this completed checklist + the full school folder.</Check>

      <Callout>
        Signed off by:                                                                                                {"\n"}
        Name: ________________________________   Role: ________________________   Date: _________________
      </Callout>

      <Footer label="Onboarding checklist" />
    </Page>
  </Document>
);

// ---------------------------------------------------------------------------
// PDF 3 — Image guide
// ---------------------------------------------------------------------------
const ImageGuide = () => (
  <Document title="Image Hosting Guide" author="Pathshala ERP">
    <Page size="A4" style={styles.page}>
      <Brand
        tag="DRIVE PHOTO GUIDE"
        title="Hosting Profile &amp; Parent Photos"
        subtitle="The ERP stores links to photos, not the photos themselves."
      />

      <Text style={styles.p}>
        Every photo goes on Google Drive, you copy the sharable link, and paste that link into the
        CSV. This keeps the ERP fast and your school's Drive remains the source of truth for the
        originals.
      </Text>

      <Text style={styles.h2}>One-time Drive setup</Text>
      <Bullet>Create a Drive folder for the school, e.g. <Text style={styles.mono}>Adeshwar - Kondagaon - 2026-27</Text>.</Bullet>
      <Bullet>Inside it, create sub-folders:</Bullet>
      <View style={{ marginLeft: 18, marginVertical: 4 }}>
        <Text style={styles.mono}>students/</Text>
        <Text style={styles.mono}>{"    profiles/      ← student face photos"}</Text>
        <Text style={styles.mono}>{"    parents/       ← parent photos"}</Text>
        <Text style={styles.mono}>staff/</Text>
        <Text style={styles.mono}>{"    profiles/"}</Text>
      </View>
      <Bullet>Share each sub-folder as <Text style={{ fontWeight: 700 }}>Anyone with the link → Viewer</Text>. Without this, the ERP can't render the image and ID cards will be blank.</Bullet>

      <Text style={styles.h2}>Naming convention</Text>
      <Text style={styles.p}>
        Always name the file after the admission number (students) or phone number (staff). This
        makes mis-pasted links easy to catch by eye.
      </Text>
      <Bullet>Student profile: <Text style={styles.mono}>K-2026-0142.jpg</Text></Bullet>
      <Bullet>Student father:  <Text style={styles.mono}>K-2026-0142-F.jpg</Text></Bullet>
      <Bullet>Student mother:  <Text style={styles.mono}>K-2026-0142-M.jpg</Text></Bullet>
      <Bullet>Staff profile:   <Text style={styles.mono}>9876543210.jpg</Text></Bullet>

      <Text style={styles.h2}>Getting the sharable link</Text>
      <Bullet>Right-click the image → Share.</Bullet>
      <Bullet>Make sure the access is "Anyone with the link → Viewer".</Bullet>
      <Bullet>Click "Copy link". The link looks like:</Bullet>
      <Text style={[styles.mono, { marginLeft: 18, marginBottom: 6 }]}>
        https://drive.google.com/file/d/1aBcDeFgHi…/view?usp=sharing
      </Text>
      <Bullet>Paste the whole link into the CSV — the ERP extracts the file id and renders the image. Do not shorten it.</Bullet>

      <View style={styles.doBox}>
        <Text style={styles.boxTitle}>DO</Text>
        <Bullet>Compress before uploading. JPG, max 2 MB, 1080 px on the long side.</Bullet>
        <Bullet>Use the school's official Drive account, not a personal Gmail.</Bullet>
        <Bullet>Keep the original folder structure intact after handover.</Bullet>
        <Bullet>Spot-check 10 random links before submitting (open in incognito).</Bullet>
        <Bullet>Use .jpg or .png. HEIC files from iPhones do not render.</Bullet>
      </View>

      <View style={styles.dontBox}>
        <Text style={styles.boxTitle}>DON'T</Text>
        <Bullet>Don't upload PDFs of photos. Export the JPG/PNG and upload that.</Bullet>
        <Bullet>Don't set Drive sharing to "Restricted" or "Specific people only".</Bullet>
        <Bullet>Don't move or rename files after pasting links into the CSV.</Bullet>
        <Bullet>Don't paste a folder link in a per-student row. One link per image, always.</Bullet>
        <Bullet>Don't use WhatsApp Web's downloaded .jfif images. Re-save as .jpg.</Bullet>
        <Bullet>Don't put images in "Shared with me" — keep them inside the school's own Drive.</Bullet>
      </View>

      <Text style={styles.h2}>When in doubt</Text>
      <Text style={styles.p}>
        Open the link in an incognito browser tab while signed out of Google. If the image loads
        there, the ERP can load it too. If you see a "Request access" screen, the sharing setting
        is wrong.
      </Text>

      <Footer label="Image hosting guide" />
    </Page>
  </Document>
);

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------
async function main() {
  if (!fs.existsSync(OUT_DIR)) {
    throw new Error(`requirements/ directory not found at ${OUT_DIR}`);
  }

  const targets: Array<[string, React.ReactElement]> = [
    [path.join(OUT_DIR, "onboarding-overview.pdf"), <Overview />],
    [path.join(OUT_DIR, "checklist.pdf"), <Checklist />],
    [path.join(OUT_DIR, "image-guide.pdf"), <ImageGuide />],
  ];

  for (const [out, element] of targets) {
    await renderToFile(element, out);
    const size = (fs.statSync(out).size / 1024).toFixed(1);
    console.log(`✓ ${path.relative(process.cwd(), out)}  (${size} KB)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
