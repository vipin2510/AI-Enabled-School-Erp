/**
 * Imports library books from the xlsx files in Library/ into the
 * Kondagaon school's `books` table. Idempotent: codes that already exist
 * are skipped. Dry-run by default — pass `--apply` to actually write.
 *
 *   npx tsx scripts/import-library-books.ts            # dry run
 *   npx tsx scripts/import-library-books.ts --apply    # write to Supabase
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in
 * .env.local.
 */
import * as path from "path";
import * as fs from "fs";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

config({ path: ".env.local" });

const KONDAGAON_SCHOOL_ID = "00000000-0000-0000-0000-000000000001";
const LIBRARY_DIR = path.resolve(__dirname, "..", "Library");
const APPLY = process.argv.includes("--apply");

type Book = {
  code: string;
  title: string;
  author: string | null;
  category: string;
  source_file: string;  // for the audit summary
  accession: string;
  publisher: string | null;
  pages: string | null;
  year: string | null;
  price: string | null;
};

// Each file maps to a (default) category and short code prefix used to build
// unique codes from the (often-overlapping) accession numbers across files.
const FILE_MAP: Record<string, { category: string; prefix: string }> = {
  "ALL IN ONE SANSKRIT.xlsx":                       { category: "Sanskrit / Primary",  prefix: "SAN" },
  "LIBRARY NO-4 VALUE EDUCATION.xlsx":              { category: "Value Education",     prefix: "VED" },
  "LIBRARY REGISTER NO-02 CHARTS AND MAP DONE.xlsx":{ category: "Charts & Maps",       prefix: "CHT" },
  "LIBRARY REGISTER NO.5 COMMERECE.xlsx":           { category: "Commerce / Accountancy", prefix: "COM" },
  // The two large multi-category files use the section title row inside
  // each sheet for the category. The prefix below is the per-file
  // fallback used in the rare row that has no clear section heading.
  "LIBRARY REGISTER NO.4 (2).xlsx":                 { category: "Science",             prefix: "SCI" },
  "WhatsApp Image 2026-06-18 at 08.16.00.xlsx":     { category: "Mathematics / Mixed", prefix: "MTH" },
};

// Heuristic: a "section divider" row is one with mostly empty cells and a
// single uppercase title in column C–E (the merged title cell in the
// originals). We use these to flip the current category mid-sheet.
function detectSectionTitle(row: unknown[]): string | null {
  const cells = row.map((c) => String(c ?? "").trim());
  const nonEmpty = cells.filter((c) => c.length > 0);
  if (nonEmpty.length === 0) return null;
  if (nonEmpty.length > 2) return null;
  const candidate = nonEmpty[0];
  if (candidate.length < 3 || candidate.length > 40) return null;
  // Must be predominantly uppercase letters.
  const upper = candidate.replace(/[^A-Za-z]/g, "");
  if (upper.length < 3) return null;
  if (upper !== upper.toUpperCase()) return null;
  // Reject S.NO / ACCESSION header keywords.
  if (/S\.?\s*NO|ACCESSION|NAME OF/i.test(candidate)) return null;
  return candidate;
}

function isHeaderRow(row: unknown[]): boolean {
  const joined = row.map((c) => String(c ?? "").toUpperCase()).join("|");
  return joined.includes("ACCESSION") && joined.includes("NAME OF");
}

function clean(s: unknown): string {
  return String(s ?? "").trim().replace(/\s+/g, " ");
}

function parseFile(filePath: string): Book[] {
  const file = path.basename(filePath);
  const wb = XLSX.readFile(filePath);
  const meta = FILE_MAP[file] ?? { category: "General", prefix: "GEN" };
  const out: Book[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
    if (rows.length === 0) continue;

    let currentCategory = meta.category;
    let headerSeen = false;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as unknown[];

      // Header row (S.NO / ACCESSION / ...): switch into data-reading mode.
      if (!headerSeen && isHeaderRow(row)) {
        headerSeen = true;
        continue;
      }

      // Section title (e.g. "BIOLOGY", "PHYSICS") sets the category for
      // following rows in this sheet.
      if (!headerSeen || hasAllSeparatorPattern(row)) {
        const title = detectSectionTitle(row);
        if (title) {
          currentCategory = title.replace(/\s+/g, " ").replace(/^\d{4}.*$/g, "");
          // Strip trailing year suffixes like "CHART-2019-20".
          currentCategory = currentCategory.replace(/[-\s]*\d{2,4}.*$/, "").trim() || title;
          // Title-case the category for the UI.
          currentCategory = currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1).toLowerCase();
        }
        continue;
      }

      // Data row. Columns: S.NO | ACCESSION | TITLE | AUTHOR | PUBLISHER | PAGES | YEAR | PRICE | REMARK
      const sno = clean(row[0]);
      const accession = clean(row[1]);
      const title = clean(row[2]);
      const author = clean(row[3]);
      const publisher = clean(row[4]);
      const pages = clean(row[5]);
      const year = clean(row[6]);
      const price = clean(row[7]);

      // Skip empty or filler rows.
      if (!title) continue;

      // Build a unique code from the file prefix + accession (or sno if
      // accession missing). If neither is present, fall back to the
      // accumulator length so we still emit something unique.
      const id = accession || sno || `r${i}`;
      const code = `${meta.prefix}-${id.replace(/[^A-Za-z0-9]/g, "")}`;

      out.push({
        code,
        title,
        author: author || null,
        category: currentCategory,
        source_file: file,
        accession: accession || sno || "",
        publisher: publisher || null,
        pages: pages || null,
        year: year || null,
        price: price || null,
      });
    }
  }
  return out;
}

// Some sheets repeat the empty separator + section title pattern between
// categories without a fresh header row. We only fall back into "look for
// section title" mode when the row is mostly blank.
function hasAllSeparatorPattern(row: unknown[]): boolean {
  const cells = row.map((c) => String(c ?? "").trim());
  return cells.filter((c) => c.length > 0).length <= 1;
}

async function main() {
  console.log(`📚  Importing into Kondagaon school (${KONDAGAON_SCHOOL_ID})`);
  console.log(`📂  Source: ${LIBRARY_DIR}`);
  console.log(`✏️  Mode: ${APPLY ? "WRITE (insert into Supabase)" : "DRY RUN — no writes"}`);
  console.log();

  const files = fs.readdirSync(LIBRARY_DIR).filter((f) => f.endsWith(".xlsx"));
  const all: Book[] = [];

  for (const file of files) {
    const books = parseFile(path.join(LIBRARY_DIR, file));
    all.push(...books);
    console.log(`  ${file} → ${books.length} books`);
  }

  // Dedupe by code (rebuild collisions with a numeric suffix).
  const seen = new Map<string, number>();
  for (const b of all) {
    const n = (seen.get(b.code) ?? 0) + 1;
    seen.set(b.code, n);
    if (n > 1) b.code = `${b.code}-${n}`;
  }

  console.log();
  console.log(`Total books parsed: ${all.length}`);

  // Category breakdown.
  const byCat = new Map<string, number>();
  for (const b of all) byCat.set(b.category, (byCat.get(b.category) ?? 0) + 1);
  console.log("\nBy category:");
  [...byCat.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([c, n]) => console.log(`  ${String(n).padStart(4)}  ${c}`));

  console.log("\nSample rows (first 5):");
  for (const b of all.slice(0, 5)) {
    console.log(`  ${b.code.padEnd(15)} ${b.title.slice(0, 50).padEnd(52)} ${b.category}`);
  }

  if (!APPLY) {
    console.log(`\n(dry-run) Re-run with --apply to insert into Supabase.`);
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Pull existing codes for this school so a re-run skips dupes silently
  // instead of failing on the global UNIQUE(books.code) constraint.
  console.log("\nFetching existing book codes…");
  const { data: existingRaw, error: exErr } = await supabase
    .from("books")
    .select("code")
    .eq("school_id", KONDAGAON_SCHOOL_ID);
  if (exErr) {
    console.error("listing existing books failed:", exErr.message);
    process.exit(1);
  }
  const existingCodes = new Set((existingRaw ?? []).map((r) => r.code));
  const fresh = all.filter((b) => !existingCodes.has(b.code));
  console.log(`  already in DB: ${all.length - fresh.length}`);
  console.log(`  to insert:     ${fresh.length}`);

  // Chunked insert — keep payload small enough that we don't hit gateway
  // size limits and so a single bad row only sinks its own batch.
  const CHUNK = 200;
  let inserted = 0;
  for (let i = 0; i < fresh.length; i += CHUNK) {
    const chunk = fresh.slice(i, i + CHUNK);
    const payload = chunk.map((b) => ({
      school_id: KONDAGAON_SCHOOL_ID,
      code: b.code,
      title: b.title,
      author: b.author,
      category: b.category,
      status: "active",
    }));
    const { error } = await supabase.from("books").insert(payload);
    if (error) {
      console.error(`  ! chunk ${i / CHUNK + 1} failed: ${error.message}`);
      continue;
    }
    inserted += chunk.length;
    process.stdout.write(`\r  inserted ${inserted} / ${fresh.length}…`);
  }
  console.log();
  console.log(`\n✓ Done. Inserted ${inserted} books into Kondagaon library.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
