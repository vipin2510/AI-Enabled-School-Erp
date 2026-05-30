/**
 * Reads the two Kondagaon student Excels and upserts students into Supabase.
 * Run with:  npm run seed:students
 *
 * RLS is disabled in migration 0001, so the publishable (anon) key can write.
 * Once you turn on RLS / auth, switch to a service-role key for seeding.
 */
import "dotenv/config";
import path from "node:path";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Missing Supabase env vars in .env.local");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const SCHOOL_IDS: Record<string, string> = {
  kondagaon: "00000000-0000-0000-0000-000000000001",
  pharasgaon: "00000000-0000-0000-0000-000000000002",
  chipawand: "00000000-0000-0000-0000-000000000003",
};

function parseSchoolArg(): { code: string; id: string } {
  const argv = process.argv.slice(2);
  let code = "kondagaon";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--school" && argv[i + 1]) {
      code = argv[i + 1];
      break;
    }
    if (argv[i].startsWith("--school=")) {
      code = argv[i].slice("--school=".length);
      break;
    }
  }
  const id = SCHOOL_IDS[code];
  if (!id) {
    throw new Error(
      `Unknown --school "${code}". Valid: ${Object.keys(SCHOOL_IDS).join(", ")}`
    );
  }
  return { code, id };
}

const { code: SCHOOL_CODE, id: SCHOOL_ID } = parseSchoolArg();

// Map sheet/class string → canonical class code that exists in `classes`.
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
  return map[v] ?? null;
}

interface Row {
  full_name: string;
  class_code: string;
  section?: string;
  blood_group?: string | null;
  father_name?: string | null;
  contact_number?: string | null;
  date_of_birth?: string | null;
  address?: string | null;
}

function parseDOB(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    const iso = `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    return iso;
  }
  const s = String(v).trim();
  const m =
    s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})$/) ||
    s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  let dd, mm, yyyy;
  if (m[0].length === 10 && m[1].length === 4) {
    yyyy = +m[1]; mm = +m[2]; dd = +m[3];
  } else {
    dd = +m[1]; mm = +m[2]; yyyy = +m[3];
    if (yyyy < 100) yyyy += 2000;
  }
  if (!dd || !mm || !yyyy) return null;
  return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

function rowsFromSheet(ws: XLSX.WorkSheet, sheetName: string): Row[] {
  const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false });
  let headerIdx = -1;
  for (let i = 0; i < Math.min(grid.length, 5); i++) {
    const row = grid[i] || [];
    const joined = row.map((c) => String(c ?? "").toUpperCase()).join("|");
    if (joined.includes("NAME OF STUDENTS") || joined.includes("S.NO.") || joined.includes("SL NO")) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return [];

  const header = (grid[headerIdx] as unknown[]).map((c) =>
    String(c ?? "").trim().toUpperCase()
  );
  const colOf = (...candidates: string[]) =>
    header.findIndex((h) => candidates.some((c) => h.includes(c)));

  const cName    = colOf("NAME OF STUDENT", "NAME");
  const cClass   = colOf("CLASS");
  const cSection = colOf("SECTION");
  const cBlood   = colOf("BLOOD");
  const cFather  = colOf("FATHER");
  const cContact = colOf("CONTACT");
  const cDob     = colOf("D.O.B", "D.O. B", "DOB");
  const cAddr    = colOf("ADDRESS");

  const out: Row[] = [];
  for (let i = headerIdx + 1; i < grid.length; i++) {
    const row = grid[i] as unknown[];
    if (!row || !row.length) continue;
    const name = row[cName];
    if (!name || typeof name !== "string" || !name.trim()) continue;
    const rawClass = row[cClass] ?? sheetName;
    const code = classCodeFor(String(rawClass));
    if (!code) continue;
    out.push({
      full_name: String(name).trim().replace(/\s+/g, " "),
      class_code: code,
      section: row[cSection] ? String(row[cSection]).trim() : undefined,
      blood_group: row[cBlood] ? String(row[cBlood]).trim() : null,
      father_name: row[cFather] ? String(row[cFather]).trim() : null,
      contact_number: row[cContact] != null ? String(row[cContact]).trim() : null,
      date_of_birth: parseDOB(row[cDob]),
      address: row[cAddr] ? String(row[cAddr]).trim() : null,
    });
  }
  return out;
}

async function main() {
  console.log(`School: ${SCHOOL_CODE} (${SCHOOL_ID})`);
  const files = [
    path.resolve("reference/KONDGAON STUDENTS DETAILS.xlsx"),
    path.resolve("reference/KONDAGAON KG.xlsx"),
  ];

  const allRows: Row[] = [];
  for (const file of files) {
    const wb = XLSX.readFile(file);
    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      const rows = rowsFromSheet(sheet, sheetName);
      console.log(`[${path.basename(file)}::${sheetName}] ${rows.length} rows`);
      allRows.push(...rows);
    }
  }
  console.log(`Total parsed: ${allRows.length}`);

  // Resolve class codes → ids
  const { data: classes, error: classErr } = await supabase
    .from("classes")
    .select("id, code")
    .eq("school_id", SCHOOL_ID);

  if (classErr) {
    console.error("\n❌ Could not query `classes` table:", classErr.message);
    console.error(
      "   Run the migrations first in Supabase SQL editor:\n" +
        "     1. supabase/migrations/0001_init_fees.sql\n" +
        "     2. supabase/migrations/0002_seed_classes_and_fees.sql\n"
    );
    process.exit(1);
  }
  if (!classes || classes.length === 0) {
    console.error(
      "\n❌ `classes` table is empty. Run 0002_seed_classes_and_fees.sql in Supabase SQL editor first.\n"
    );
    process.exit(1);
  }

  const codeToId = new Map(classes.map((c) => [c.code, c.id]));

  // Build payloads. Drop rows whose class code is unknown (and report which).
  const dropped: Record<string, number> = {};
  const payload = allRows
    .map((r) => {
      const class_id = codeToId.get(r.class_code);
      if (!class_id) {
        dropped[r.class_code] = (dropped[r.class_code] ?? 0) + 1;
        return null;
      }
      return {
        full_name: r.full_name,
        class_id,
        section: r.section ?? null,
        blood_group: r.blood_group ?? null,
        father_name: r.father_name ?? null,
        contact_number: r.contact_number ?? null,
        date_of_birth: r.date_of_birth ?? null,
        address: r.address ?? null,
        school_id: SCHOOL_ID,
      };
    })
    .filter(Boolean) as Record<string, unknown>[];

  if (Object.keys(dropped).length) {
    console.warn("⚠️  Dropped rows because class code missing in DB:", dropped);
  }
  console.log(`Inserting ${payload.length} students…`);

  // Chunked insert (Supabase REST limit safety)
  const CHUNK = 500;
  for (let i = 0; i < payload.length; i += CHUNK) {
    const slice = payload.slice(i, i + CHUNK);
    const { error } = await supabase.from("students").insert(slice);
    if (error) {
      console.error("Insert error:", error);
      throw error;
    }
    console.log(`  ${i + slice.length}/${payload.length}`);
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
