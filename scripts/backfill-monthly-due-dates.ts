/**
 * Backfill `due_date` on monthly fee-structure components that are missing it.
 *
 * Late fees only accrue for components that have a due_date (see the collect
 * form). Kondagaon was seeded with due dates via migration 0002, but schools
 * created later (Pharasgaon, Chipawand, demos) got monthly components with a
 * NULL due_date, so late fees never triggered for them.
 *
 * The due_date for a monthly component = the 10th of its month, where the month
 * comes from `period_index` (4=Apr … 12=Dec, 1..3 = Jan..Mar) and the year from
 * the parent structure's academic_year ("2026-27" → Apr–Dec 2026, Jan–Mar 2027).
 * The collect form overrides the DAY to the configurable monthly_due_day, so the
 * stored day only needs to land in the right month.
 *
 *   npx tsx scripts/backfill-monthly-due-dates.ts            # dry run
 *   npx tsx scripts/backfill-monthly-due-dates.ts --execute  # write
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const EXECUTE = process.argv.includes("--execute");
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: "erp" }, auth: { persistSession: false } }
);

// Academic year "2026-27" → start year 2026 (April). Months 4..12 fall in the
// start year; 1..3 fall in the next.
function dueDateFor(periodIndex: number, academicYear: string): string | null {
  const m = periodIndex;
  if (!m || m < 1 || m > 12) return null;
  const startYear = Number(String(academicYear).slice(0, 4));
  if (!Number.isFinite(startYear)) return null;
  const year = m >= 4 ? startYear : startYear + 1;
  return `${year}-${String(m).padStart(2, "0")}-10`;
}

async function main() {
  // structure_id → academic_year
  const { data: structures, error: sErr } = await sb
    .from("fee_structures")
    .select("id, academic_year");
  if (sErr) throw sErr;
  const ayById = new Map((structures ?? []).map((s) => [s.id, s.academic_year as string]));

  // all monthly components missing a due_date
  const { data: comps, error: cErr } = await sb
    .from("fee_structure_components")
    .select("id, structure_id, period_index, kind, due_date")
    .eq("kind", "monthly")
    .is("due_date", null);
  if (cErr) throw cErr;

  const updates: { id: string; due_date: string }[] = [];
  let skipped = 0;
  for (const c of comps ?? []) {
    const ay = ayById.get(c.structure_id);
    const due = ay ? dueDateFor(c.period_index as number, ay) : null;
    if (!due) {
      skipped++;
      continue;
    }
    updates.push({ id: c.id as string, due_date: due });
  }

  console.log(`Monthly components missing due_date: ${comps?.length ?? 0}`);
  console.log(`Will set: ${updates.length}, skipped (no AY / bad period): ${skipped}`);
  // Show a small sample of the mapping
  console.log("Sample:", JSON.stringify(updates.slice(0, 6)));

  if (!EXECUTE) {
    console.log("\n(dry run — pass --execute to write)");
    return;
  }

  // Group by due_date so we can update many rows per request (there are only
  // ~12 distinct dates — one per month).
  const byDate = new Map<string, string[]>();
  for (const u of updates) {
    (byDate.get(u.due_date) ?? byDate.set(u.due_date, []).get(u.due_date)!).push(u.id);
  }
  for (const [due, ids] of byDate) {
    // Chunk the id list to keep the URL length sane.
    const CHUNK = 300;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK);
      const { error } = await sb
        .from("fee_structure_components")
        .update({ due_date: due })
        .in("id", slice);
      if (error) throw error;
    }
    console.log(`  ${due}: ${ids.length} rows`);
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
