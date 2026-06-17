/**
 * Backfills empty school-scope fee structures (+ component skeleton) for any
 * classes that don't already have one for the given academic year. Mirrors the
 * shape used by migration 0002 and the addClass server action so the existing
 * /fees/structures editor finds the same component kinds.
 *
 *   npx tsx scripts/backfill-fee-structures.ts            # current AY
 *   npx tsx scripts/backfill-fee-structures.ts 2026-27    # explicit AY
 *
 * Idempotent: a class with a (school, class, AY, scope='school',
 * student_kind='any') row already there is skipped.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function currentAcademicYear(now: Date = new Date()): string {
  const y = now.getFullYear();
  const startYear = now.getMonth() + 1 >= 4 ? y : y - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

async function main() {
  const ay = process.argv[2] ?? currentAcademicYear();
  console.log(`Backfilling fee structures for AY ${ay}…`);

  const { data: classes, error: classesErr } = await supabase
    .from("classes")
    .select("id, school_id, display_name, ordinal")
    .order("ordinal");
  if (classesErr) {
    console.error("Failed to load classes:", classesErr.message);
    process.exit(1);
  }

  let created = 0;
  let skipped = 0;

  for (const cls of classes ?? []) {
    const { data: existing } = await supabase
      .from("fee_structures")
      .select("id")
      .eq("school_id", cls.school_id)
      .eq("class_id", cls.id)
      .eq("academic_year", ay)
      .eq("scope", "school")
      .eq("student_kind", "any")
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    const { data: fs, error: fsErr } = await supabase
      .from("fee_structures")
      .insert({
        academic_year: ay,
        scope: "school",
        class_id: cls.id,
        student_kind: "any",
        total_amount: 0,
        school_id: cls.school_id,
      })
      .select("id")
      .single();
    if (fsErr || !fs) {
      console.error(`  ! ${cls.display_name}: ${fsErr?.message ?? "insert failed"}`);
      continue;
    }

    // Apr-start session: month 1 of the structure = April.
    const monthly = Array.from({ length: 12 }, (_, i) => {
      const monthIdx = ((3 + i) % 12) + 1;
      return {
        structure_id: fs.id,
        kind: "monthly",
        label: `Monthly Fee — ${MONTHS[monthIdx - 1]}`,
        period_index: monthIdx,
        amount: 0,
        is_refundable: false,
        is_one_time: false,
        sort_order: 100 + i,
        school_id: cls.school_id,
      };
    });

    const { error: compErr } = await supabase.from("fee_structure_components").insert([
      {
        structure_id: fs.id, kind: "registration", label: "Registration Fee",
        period_index: null, amount: 0, is_refundable: false, is_one_time: true,
        sort_order: 0, school_id: cls.school_id,
      },
      {
        structure_id: fs.id, kind: "admission_one_time", label: "New Admission Fee",
        period_index: null, amount: 0, is_refundable: false, is_one_time: true,
        sort_order: 1, school_id: cls.school_id,
      },
      {
        structure_id: fs.id, kind: "caution", label: "Caution Money",
        period_index: null, amount: 0, is_refundable: true, is_one_time: true,
        sort_order: 2, school_id: cls.school_id,
      },
      {
        structure_id: fs.id, kind: "yearly", label: "Yearly Fee (Books/Dev)",
        period_index: null, amount: 0, is_refundable: false, is_one_time: true,
        sort_order: 3, school_id: cls.school_id,
      },
      ...monthly,
    ]);
    if (compErr) {
      console.error(`  ! ${cls.display_name}: components ${compErr.message}`);
      continue;
    }

    created++;
    console.log(`  ✓ ${cls.display_name} (school ${cls.school_id})`);
  }

  console.log(`Done. created=${created} skipped=${skipped}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
