/**
 * One-off importer for "KONDAGAON KG SECTION (LKG AND UKG).xlsx".
 *
 * The roster is ~98% already in the DB, so this is NON-DESTRUCTIVE:
 *   - inserts students that don't exist yet (matched by admission_no, else name)
 *   - backfills ONLY fields that are currently blank on existing rows
 *   - never overwrites an existing non-empty value
 *   - skips the `gender` column entirely (the file's UKG gender col is garbage:
 *     55x "M" / 1x "F"; LKG has no gender column at all)
 *
 * Dry-run by default. Pass --execute to write.
 *   npx tsx scripts/import-kondagaon-kg.ts            # dry run
 *   npx tsx scripts/import-kondagaon-kg.ts --execute  # write
 */
import "dotenv/config";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const EXECUTE = process.argv.includes("--execute");
const FILE = "KONDAGAON KG SECTION (LKG AND UKG).xlsx";
const SCHOOL_ID = "00000000-0000-0000-0000-000000000001"; // Adeshwar, Kondagaon
const CLASS_IDS: Record<string, string> = {
  LKG: "f73f1fe1-41f6-479d-8400-de0b52a6a373",
  UKG: "228e542e-3ed3-4931-a198-8c785d458832",
};

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: "erp" }, auth: { persistSession: false } }
);

const norm = (s: unknown) => String(s ?? "").trim().replace(/\s+/g, " ");
const normKey = (s: unknown) => norm(s).toUpperCase();
const isNumericAdmn = (s: unknown) => /^\d+$/.test(String(s ?? "").trim());

function parseDOB(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d || !d.y) return null;
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  const m =
    s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})$/) ||
    s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  let dd: number, mm: number, yyyy: number;
  if (m[0].length >= 8 && m[1].length === 4) {
    yyyy = +m[1]; mm = +m[2]; dd = +m[3];
  } else {
    dd = +m[1]; mm = +m[2]; yyyy = +m[3];
    if (yyyy < 100) yyyy += 2000;
  }
  if (!dd || !mm || !yyyy) return null;
  return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

interface FileRow {
  class_code: "LKG" | "UKG";
  full_name: string;
  admission_no: string | null;
  section: string | null;
  blood_group: string | null;
  father_name: string | null;
  mother_name: string | null;
  contact_number: string | null;
  date_of_birth: string | null;
  address: string | null;
}

function cell(row: unknown[], idx: number): string | null {
  if (idx < 0) return null;
  const v = row[idx];
  if (v == null) return null;
  const s = norm(v);
  if (!s || s === "0") return null;
  return s;
}

function parseFile(): FileRow[] {
  const wb = XLSX.readFile(FILE);
  const out: FileRow[] = [];
  for (const sheet of wb.SheetNames) {
    const cls = normKey(sheet) as "LKG" | "UKG";
    if (!CLASS_IDS[cls]) continue;
    const grid: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheet], {
      header: 1,
      blankrows: false,
    });
    // header row is the first that contains "NAME OF STUDENT"
    const hIdx = grid.findIndex((r) =>
      (r || []).some((c) => normKey(c).includes("NAME OF STUDENT"))
    );
    if (hIdx < 0) continue;
    const header = (grid[hIdx] as unknown[]).map((c) => normKey(c));
    const col = (...cands: string[]) =>
      header.findIndex((h) => cands.some((c) => h.replace(/\s+/g, "").includes(c)));
    const cName = col("NAMEOFSTUDENT", "NAME");
    const cAdmn = col("ADMN");
    const cSection = col("SECTION");
    const cBlood = col("BLOOD");
    const cFather = col("FATHER");
    const cMother = col("MOTHER");
    const cContact = col("CONTACT");
    const cDob = col("D.O.B", "DOB");
    const cAddr = col("ADDRESS");
    for (let i = hIdx + 1; i < grid.length; i++) {
      const row = grid[i] as unknown[];
      const name = cell(row, cName);
      if (!name) continue;
      const admn = cAdmn >= 0 ? String(row[cAdmn] ?? "").trim() : "";
      out.push({
        class_code: cls,
        full_name: name,
        admission_no: isNumericAdmn(admn) ? admn : null,
        section: cell(row, cSection),
        blood_group: cell(row, cBlood),
        father_name: cell(row, cFather),
        mother_name: cell(row, cMother),
        contact_number: cell(row, cContact),
        date_of_birth: parseDOB(row[cDob]),
        address: cell(row, cAddr),
      });
    }
  }
  return out;
}

// Fields we backfill (gender deliberately excluded).
const BACKFILL_FIELDS = [
  "admission_no",
  "section",
  "blood_group",
  "father_name",
  "mother_name",
  "contact_number",
  "date_of_birth",
  "address",
] as const;

function dbBlank(existing: Record<string, unknown>, field: string): boolean {
  const v = existing[field];
  if (v == null || String(v).trim() === "") return true;
  // a non-numeric admission_no is treated as corrupt/blank (e.g. "LITHVIK NAIDU")
  if (field === "admission_no" && !isNumericAdmn(v)) return true;
  return false;
}

async function main() {
  const fileRows = parseFile();
  console.log(`Parsed ${fileRows.length} file rows (LKG ${fileRows.filter(r => r.class_code === "LKG").length}, UKG ${fileRows.filter(r => r.class_code === "UKG").length})`);

  const { data: existing, error } = await sb
    .from("students")
    .select("*")
    .in("class_id", [CLASS_IDS.LKG, CLASS_IDS.UKG]);
  if (error) throw error;

  // global set of admission numbers already taken (unique constraint is global)
  const { data: allAdmn } = await sb.from("students").select("admission_no");
  const takenAdmn = new Set(
    (allAdmn || []).map((r) => String(r.admission_no ?? "").trim()).filter((s) => s && isNumericAdmn(s))
  );

  const exByAdmn = new Map<string, Record<string, unknown>>();
  const exByName = new Map<string, Record<string, unknown>>();
  for (const e of existing || []) {
    if (e.admission_no && isNumericAdmn(e.admission_no)) exByAdmn.set(String(e.admission_no).trim(), e);
    exByName.set(normKey(e.full_name), e);
  }

  const inserts: Record<string, unknown>[] = [];
  const updates: { id: string; name: string; patch: Record<string, unknown> }[] = [];
  const conflicts: string[] = [];

  for (const f of fileRows) {
    const match =
      (f.admission_no && exByAdmn.get(f.admission_no)) ||
      exByName.get(normKey(f.full_name)) ||
      null;

    if (!match) {
      const rec: Record<string, unknown> = {
        full_name: f.full_name,
        class_id: CLASS_IDS[f.class_code],
        school_id: SCHOOL_ID,
        section: f.section,
        blood_group: f.blood_group,
        father_name: f.father_name,
        mother_name: f.mother_name,
        contact_number: f.contact_number,
        date_of_birth: f.date_of_birth,
        address: f.address,
      };
      if (f.admission_no && !takenAdmn.has(f.admission_no)) {
        rec.admission_no = f.admission_no;
        takenAdmn.add(f.admission_no);
      }
      inserts.push(rec);
      continue;
    }

    // backfill blanks only
    const patch: Record<string, unknown> = {};
    for (const field of BACKFILL_FIELDS) {
      const fileVal = (f as Record<string, unknown>)[field];
      if (fileVal == null || String(fileVal).trim() === "") continue;
      if (!dbBlank(match, field)) {
        // DB has a value. Flag admission_no mismatches for manual review.
        if (field === "admission_no" && String(match[field]).trim() !== String(fileVal).trim()) {
          conflicts.push(`${f.full_name}: DB admission_no=${match[field]} vs file=${fileVal} (kept DB)`);
        }
        continue;
      }
      if (field === "admission_no") {
        // don't create a duplicate admission_no
        if (takenAdmn.has(String(fileVal))) {
          conflicts.push(`${f.full_name}: file admission_no=${fileVal} already used by another row (skipped)`);
          continue;
        }
        takenAdmn.add(String(fileVal));
      }
      patch[field] = fileVal;
    }
    if (Object.keys(patch).length) {
      updates.push({ id: match.id as string, name: f.full_name, patch });
    }
  }

  console.log(`\n=== PLAN ===`);
  console.log(`Inserts (net-new): ${inserts.length}`);
  inserts.forEach((r) => console.log(`  + ${r.full_name} [${r.admission_no ?? "no-admn"}] (${r.class_id === CLASS_IDS.LKG ? "LKG" : "UKG"})`));
  console.log(`\nBackfill updates: ${updates.length}`);
  updates.forEach((u) => console.log(`  ~ ${u.name}: ${JSON.stringify(u.patch)}`));
  console.log(`\nConflicts flagged (manual review, NOT changed): ${conflicts.length}`);
  conflicts.forEach((c) => console.log(`  ! ${c}`));

  if (!EXECUTE) {
    console.log(`\n(dry run — pass --execute to write)`);
    return;
  }

  console.log(`\n=== EXECUTING ===`);
  if (inserts.length) {
    const { error: e } = await sb.from("students").insert(inserts);
    if (e) throw e;
    console.log(`Inserted ${inserts.length}`);
  }
  for (const u of updates) {
    const { error: e } = await sb.from("students").update(u.patch).eq("id", u.id);
    if (e) throw e;
  }
  console.log(`Updated ${updates.length}`);
  console.log(`Done.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
