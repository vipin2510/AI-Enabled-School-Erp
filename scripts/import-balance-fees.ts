/**
 * Import per-student carry-forward opening dues from the balance spreadsheet
 * into erp.student_opening_dues. Each row's TOTAL becomes the student's opening
 * due for the given academic year; these feed the Collect-screen Outstanding
 * and the TC no-dues check. Nothing is invoiced.
 *
 *   DRY_RUN=1 npx tsx scripts/import-balance-fees.ts             # preview + unmatched report
 *   npx tsx scripts/import-balance-fees.ts                       # write
 *   npx tsx scripts/import-balance-fees.ts --file "/path.xlsx" --school kondagaon --ay 2025-26
 *
 * The sheet groups students under class-name header rows (only the name column
 * filled, no S.No). Matching is by normalized name WITHIN the current class;
 * anything unmatched/ambiguous is written to scratchpad/balance-import-unmatched.csv.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { config } from "dotenv";
import fs from "node:fs";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });
config();

const DRY_RUN = !!process.env.DRY_RUN;

const SCHOOL_IDS: Record<string, string> = {
  kondagaon: "00000000-0000-0000-0000-000000000001",
  pharasgaon: "00000000-0000-0000-0000-000000000002",
  chipawand: "00000000-0000-0000-0000-000000000003",
};

function arg(name: string, dflt: string): string {
  const argv = process.argv.slice(2);
  const i = argv.indexOf(`--${name}`);
  if (i >= 0 && argv[i + 1]) return argv[i + 1];
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  return dflt;
}

const FILE = arg("file", `${process.env.HOME}/Downloads/BALANCE FEE 2025-26.xlsx`);
const SCHOOL_CODE = arg("school", "kondagaon");
const SCHOOL_ID = SCHOOL_IDS[SCHOOL_CODE] ?? SCHOOL_CODE; // allow a raw uuid too
const AY = arg("ay", "2025-26");
const UNMATCHED_CSV =
  process.env.SCRATCHPAD
    ? `${process.env.SCRATCHPAD}/balance-import-unmatched.csv`
    : "balance-import-unmatched.csv";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  db: { schema: "erp" },
  auth: { autoRefreshToken: false, persistSession: false },
});

// Sheet class label → canonical class code (tolerant of typos like NURSERRY).
function classCodeFor(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const v = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, "");
  const map: Record<string, string> = {
    PLAYGROUP: "PLAY", PLAY: "PLAY",
    NURSERY: "NUR", NUR: "NUR",
    LKG: "LKG", UKG: "UKG",
    I: "1ST", "1ST": "1ST", "1": "1ST",
    II: "2ND", "2ND": "2ND", "2": "2ND",
    III: "3RD", "3RD": "3RD", "3": "3RD",
    IV: "4TH", "4TH": "4TH", "4": "4TH",
    V: "5TH", "5TH": "5TH", "5": "5TH",
    VI: "6TH", "6TH": "6TH", "6": "6TH",
    VII: "7TH", "7TH": "7TH", "7": "7TH",
    VIII: "8TH", "8TH": "8TH", "8": "8TH",
    IX: "9TH", "9TH": "9TH", "9": "9TH",
    X: "10TH", "10TH": "10TH", "10": "10TH",
    XI: "11_SCI", "11TH": "11_SCI", "11": "11_SCI",
    XII: "12_SCI", "12TH": "12_SCI", "12": "12_SCI",
  };
  if (map[v]) return map[v];
  // "CLASS-3" / "CLASS -12" → strip to "CLASS3" / "CLASS12" → map by number.
  const numByClass = v.match(/^CLASS(\d+)$/);
  if (numByClass) {
    const byNum: Record<string, string> = {
      "1": "1ST", "2": "2ND", "3": "3RD", "4": "4TH", "5": "5TH", "6": "6TH",
      "7": "7TH", "8": "8TH", "9": "9TH", "10": "10TH", "11": "11_SCI", "12": "12_SCI",
    };
    return byNum[numByClass[1]] ?? null;
  }
  // Tolerant prefixes for scanned/typo'd headers.
  if (v.startsWith("PLAY")) return "PLAY";
  if (v.startsWith("NURS")) return "NUR";
  if (v.startsWith("LKG")) return "LKG";
  if (v.startsWith("UKG")) return "UKG";
  return null;
}

const norm = (s: unknown) =>
  String(s ?? "").toUpperCase().replace(/\s+/g, " ").trim();
const isNum = (x: unknown) =>
  typeof x === "number" || (typeof x === "string" && x.trim() !== "" && !isNaN(Number(x)));

type Rec = { classCode: string; name: string; total: number; rowNo: number };

function parseSheet(): Rec[] {
  const wb = XLSX.readFile(FILE);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false });

  // Locate the header row (has STUDENT NAME + TOTAL); derive the two columns.
  let headerIdx = -1;
  for (let i = 0; i < Math.min(grid.length, 6); i++) {
    const joined = (grid[i] || []).map((c) => String(c ?? "").toUpperCase()).join("|");
    if (joined.includes("STUDENT NAME") && joined.includes("TOTAL")) { headerIdx = i; break; }
  }
  if (headerIdx === -1) throw new Error("Could not find header row (STUDENT NAME / TOTAL).");
  const header = (grid[headerIdx] as unknown[]).map((c) => String(c ?? "").toUpperCase());
  const colName = header.findIndex((h) => h.includes("STUDENT NAME"));
  const colTotal = header.lastIndexOf(header.filter((h) => h.includes("TOTAL")).pop() as string);

  const out: Rec[] = [];
  let currentClass: string | null = null;
  const skippedLabels = new Set<string>();
  for (let i = headerIdx + 1; i < grid.length; i++) {
    const row = (grid[i] as unknown[]) || [];
    const nameCell = row[colName];
    if (nameCell == null || String(nameCell).trim() === "") continue;

    // A real student row always carries a numeric TOTAL. Rows without one are
    // either a class header (e.g. "CLASS-3", "NURSERY") or a stray label
    // ("HOSTEL FEE"). Header detection is name-based, not S.No-based, because
    // some student rows have a blank S.No.
    if (!isNum(row[colTotal])) {
      const code = classCodeFor(String(nameCell));
      if (code) currentClass = code;
      else skippedLabels.add(String(nameCell).trim());
      continue;
    }
    if (!currentClass) continue; // student before any class header — skip
    out.push({ classCode: currentClass, name: norm(nameCell), total: Number(row[colTotal]) || 0, rowNo: i + 1 });
  }
  if (skippedLabels.size) console.warn("ℹ️  Ignored non-class labels:", [...skippedLabels]);
  return out;
}

// Page through a query 1000 rows at a time (PostgREST's default cap).
async function fetchAll<T>(fetchPage: (from: number, to: number) => Promise<T[]>): Promise<T[]> {
  const PAGE = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const batch = await fetchPage(from, from + PAGE - 1);
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return rows;
}

async function main() {
  console.log(`${DRY_RUN ? "DRY RUN — " : ""}import ${FILE}\n  school=${SCHOOL_CODE} ay=${AY}\n`);
  const records = parseSheet();
  console.log(`Parsed ${records.length} student rows.`);

  // Match by name SCHOOL-WIDE, not within the sheet's class: the balance sheet
  // records each student's 2025-26 class, but in the DB (2026-27) they've been
  // promoted, so their current class differs. Names are unique enough that a
  // school-wide match resolves almost all; genuine duplicate names fall out as
  // "ambiguous" for manual resolution.
  const students = await fetchAll<{ id: string; full_name: string; class_id: string | null }>(async (from, to) => {
    const { data, error } = await supabase
      .from("students").select("id, full_name, class_id").eq("school_id", SCHOOL_ID).range(from, to);
    if (error) throw error;
    return (data ?? []) as { id: string; full_name: string; class_id: string | null }[];
  });
  const byName = new Map<string, string[]>();
  for (const s of students) {
    const key = norm(s.full_name);
    byName.set(key, [...(byName.get(key) ?? []), s.id]);
  }

  const matched: { student_id: string; amount: number }[] = [];
  const unmatched: string[] = ["row,sheet_class,name,total,reason"];
  let ambiguous = 0, missing = 0;

  for (const r of records) {
    const hits = byName.get(r.name) ?? [];
    if (hits.length === 1) matched.push({ student_id: hits[0], amount: r.total });
    else if (hits.length > 1) { ambiguous++; unmatched.push(`${r.rowNo},${r.classCode},"${r.name}",${r.total},ambiguous-${hits.length}-matches`); }
    else { missing++; unmatched.push(`${r.rowNo},${r.classCode},"${r.name}",${r.total},no-match`); }
  }

  console.log(`\nMatched: ${matched.length}`);
  console.log(`Unmatched: ${missing} no-match, ${ambiguous} ambiguous`);
  if (unmatched.length > 1) {
    fs.writeFileSync(UNMATCHED_CSV, unmatched.join("\n"));
    console.log(`Unmatched report → ${UNMATCHED_CSV}`);
  }

  if (DRY_RUN) { console.log("\nDRY RUN — nothing written."); return; }
  if (!matched.length) { console.log("Nothing to write."); return; }

  const payload = matched.map((m) => ({
    school_id: SCHOOL_ID,
    student_id: m.student_id,
    academic_year: AY,
    amount: m.amount,
    source: `import ${AY}`,
    updated_at: new Date().toISOString(),
  }));
  const CHUNK = 500;
  for (let i = 0; i < payload.length; i += CHUNK) {
    const slice = payload.slice(i, i + CHUNK);
    const { error } = await supabase
      .from("student_opening_dues")
      .upsert(slice, { onConflict: "student_id,academic_year" });
    if (error) throw error;
    console.log(`  upserted ${Math.min(i + CHUNK, payload.length)}/${payload.length}`);
  }
  console.log("Done.");
}

main().catch((e) => { console.error(e); process.exit(1); });
