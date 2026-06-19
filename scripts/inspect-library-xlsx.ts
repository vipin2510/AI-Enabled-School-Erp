/**
 * Inspects each xlsx in Library/ — prints sheet names, headers, first 5 rows.
 *   npx tsx scripts/inspect-library-xlsx.ts
 */
import * as path from "path";
import * as fs from "fs";
import * as XLSX from "xlsx";

const LIBRARY_DIR = path.resolve(__dirname, "..", "Library");

function main() {
  const files = fs.readdirSync(LIBRARY_DIR).filter((f) => f.endsWith(".xlsx"));
  for (const file of files) {
    console.log("\n" + "=".repeat(80));
    console.log(`📚 ${file}`);
    console.log("=".repeat(80));
    const wb = XLSX.readFile(path.join(LIBRARY_DIR, file));
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
      console.log(`\n  Sheet: "${sheetName}" — ${rows.length} rows`);
      if (rows.length === 0) continue;
      // First 8 rows to see header + a few data rows
      const preview = rows.slice(0, 8);
      preview.forEach((row, i) => {
        const cells = (row as unknown[]).slice(0, 12).map((c) => {
          const s = String(c ?? "").trim();
          return s.length > 30 ? s.slice(0, 27) + "…" : s;
        });
        console.log(`  ${String(i).padStart(2)}: [${cells.join(" | ")}]`);
      });
    }
  }
}
main();
