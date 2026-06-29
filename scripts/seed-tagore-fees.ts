/**
 * Seed Tagore institutes' classes + fee structures from their published PDFs.
 *
 *   npx tsx scripts/seed-tagore-fees.ts
 *
 * Idempotent: classes are upserted by (school_id, code); a fee structure is
 * created only if one doesn't already exist for that (school, class, AY, scope),
 * so re-running won't duplicate components.
 *
 * Sources (Tagore Group/*.pdf):
 *  - School (TISBSP): quarterly fees by class band (4 quarters).
 *  - Pharmacy (TIPR) + Management (TCMBSP): 3 installments per course year
 *    (same D.Pharmacy structure, per instruction).
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });
config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const AY = "2026-27"; // matches currentAcademicYear() for 2026
const TIPR = "00000000-0000-0000-0000-0000000000a1"; // pharmacy
const TISBSP = "00000000-0000-0000-0000-0000000000a2"; // school
const TCMBSP = "00000000-0000-0000-0000-0000000000a3"; // management

type Comp = {
  kind: string;
  label: string;
  period_index: number | null;
  amount: number;
  due_date?: string | null;
  is_refundable?: boolean;
  is_one_time?: boolean;
  sort_order: number;
};
type ClassSeed = {
  code: string;
  display_name: string;
  ordinal: number;
  group_label: string | null;
  total: number;
  components: Comp[];
};

// --- School (TISBSP): quarterly, by class band -----------------------------
const QUARTER_DUE = ["2026-04-07", "2026-09-11", "2026-11-11", "2027-01-11"];
const quarters = (q: number[]): Comp[] =>
  q.map((amount, i) => ({
    kind: "quarterly",
    label: `${["1st", "2nd", "3rd", "4th"][i]} Quarter`,
    period_index: i + 1,
    amount,
    due_date: QUARTER_DUE[i],
    sort_order: i,
  }));

// band → [Q1,Q2,Q3,Q4]
const BANDS: { label: string; q: number[]; classes: { code: string; name: string; ord: number }[] }[] = [
  {
    label: "NURSERY TO KG-II",
    q: [5950, 5950, 5950, 5950],
    classes: [
      { code: "NUR", name: "Nursery", ord: 1 },
      { code: "KG1", name: "KG-I", ord: 2 },
      { code: "KG2", name: "KG-II", ord: 3 },
    ],
  },
  {
    label: "CLASS I TO V",
    q: [8800, 8800, 8800, 8800],
    classes: [
      { code: "C1", name: "Class I", ord: 4 },
      { code: "C2", name: "Class II", ord: 5 },
      { code: "C3", name: "Class III", ord: 6 },
      { code: "C4", name: "Class IV", ord: 7 },
      { code: "C5", name: "Class V", ord: 8 },
    ],
  },
  {
    label: "CLASS VI TO VIII",
    q: [9700, 9600, 9600, 9600],
    classes: [
      { code: "C6", name: "Class VI", ord: 9 },
      { code: "C7", name: "Class VII", ord: 10 },
      { code: "C8", name: "Class VIII", ord: 11 },
    ],
  },
  {
    label: "CLASS IX TO X",
    q: [11550, 11550, 11550, 11550],
    classes: [
      { code: "C9", name: "Class IX", ord: 12 },
      { code: "C10", name: "Class X", ord: 13 },
    ],
  },
];

const schoolClasses: ClassSeed[] = BANDS.flatMap((b) =>
  b.classes.map((c) => ({
    code: c.code,
    display_name: c.name,
    ordinal: c.ord,
    group_label: b.label,
    total: b.q.reduce((s, n) => s + n, 0),
    components: quarters(b.q),
  })),
);

// --- Pharmacy + Management: 3 installments per course year -----------------
const courseYearComponents = (amts: number[], labels: string[]): Comp[] =>
  amts.map((amount, i) => ({
    kind: "instalment",
    label: labels[i],
    period_index: i + 1,
    amount,
    sort_order: i,
  }));

const collegeClasses: ClassSeed[] = [
  {
    code: "Y1",
    display_name: "1st Year",
    ordinal: 1,
    group_label: null,
    total: 67950,
    components: courseYearComponents(
      [27950, 20000, 20000],
      ["1st Installment (Admission)", "2nd Installment (1st Sessional)", "3rd Installment (2nd Sessional)"],
    ),
  },
  {
    code: "Y2",
    display_name: "2nd Year",
    ordinal: 2,
    group_label: null,
    total: 61450,
    components: courseYearComponents(
      [21450, 20000, 20000],
      ["1st Installment (Registration)", "2nd Installment (1st Sessional)", "3rd Installment (2nd Sessional)"],
    ),
  },
];

async function seedInstitute(schoolId: string, name: string, classes: ClassSeed[]) {
  console.log(`\n=== ${name} ===`);
  for (const cls of classes) {
    // 1. Upsert the class (unique per school_id, code).
    const { data: clsRow, error: clsErr } = await db
      .from("classes")
      .upsert(
        {
          school_id: schoolId,
          code: cls.code,
          display_name: cls.display_name,
          ordinal: cls.ordinal,
          group_label: cls.group_label,
        },
        { onConflict: "school_id,code" },
      )
      .select("id")
      .single();
    if (clsErr || !clsRow) {
      console.error(`  ! class ${cls.code}: ${clsErr?.message}`);
      continue;
    }

    // 2. Skip if a structure already exists for this (school, class, AY, school-scope).
    const { data: existing } = await db
      .from("fee_structures")
      .select("id")
      .eq("school_id", schoolId)
      .eq("class_id", clsRow.id)
      .eq("academic_year", AY)
      .eq("scope", "school")
      .maybeSingle();
    if (existing) {
      console.log(`  = ${cls.display_name}: structure exists, skipped`);
      continue;
    }

    // 3. Create the structure + its components.
    const { data: fs, error: fsErr } = await db
      .from("fee_structures")
      .insert({
        academic_year: AY,
        scope: "school",
        class_id: clsRow.id,
        group_label: null,
        student_kind: "any",
        total_amount: cls.total,
        school_id: schoolId,
      })
      .select("id")
      .single();
    if (fsErr || !fs) {
      console.error(`  ! structure ${cls.code}: ${fsErr?.message}`);
      continue;
    }
    const rows = cls.components.map((c) => ({
      structure_id: fs.id,
      kind: c.kind,
      label: c.label,
      period_index: c.period_index,
      amount: c.amount,
      due_date: c.due_date ?? null,
      is_refundable: c.is_refundable ?? false,
      is_one_time: c.is_one_time ?? false,
      sort_order: c.sort_order,
      school_id: schoolId,
    }));
    const { error: compErr } = await db.from("fee_structure_components").insert(rows);
    if (compErr) {
      console.error(`  ! components ${cls.code}: ${compErr.message}`);
      continue;
    }
    console.log(`  + ${cls.display_name}: ₹${cls.total} (${rows.length} components)`);
  }
}

async function main() {
  await seedInstitute(TISBSP, "Tagore International School (quarterly)", schoolClasses);
  await seedInstitute(TIPR, "Tagore Institute of Pharmacy & Research (installments)", collegeClasses);
  await seedInstitute(TCMBSP, "Tagore College of Management (installments)", collegeClasses);
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
