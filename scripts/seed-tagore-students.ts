/**
 * Seed 3 dummy students into each Tagore institute, assigned to existing
 * classes (so fee collection can be tested end-to-end).
 *
 *   npx tsx scripts/seed-tagore-students.ts
 *
 * Idempotent: skips a student if their admission_no already exists.
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

const TIPR = "00000000-0000-0000-0000-0000000000a1"; // pharmacy
const TISBSP = "00000000-0000-0000-0000-0000000000a2"; // school
const TCMBSP = "00000000-0000-0000-0000-0000000000a3"; // management

// admission_no, name, class code (must exist for that school), father, phone
type S = { adm: string; name: string; classCode: string; father: string; phone: string };

const STUDENTS: { schoolId: string; label: string; rows: S[] }[] = [
  {
    schoolId: TISBSP,
    label: "Tagore International School",
    rows: [
      { adm: "TIS-001", name: "Aarav Sharma", classCode: "C1", father: "Rakesh Sharma", phone: "9000000001" },
      { adm: "TIS-002", name: "Diya Verma", classCode: "C6", father: "Manish Verma", phone: "9000000002" },
      { adm: "TIS-003", name: "Kabir Singh", classCode: "C9", father: "Harish Singh", phone: "9000000003" },
    ],
  },
  {
    schoolId: TIPR,
    label: "Tagore Institute of Pharmacy & Research",
    rows: [
      { adm: "TIP-001", name: "Riya Patel", classCode: "Y1", father: "Suresh Patel", phone: "9000000011" },
      { adm: "TIP-002", name: "Arjun Nair", classCode: "Y1", father: "Mohan Nair", phone: "9000000012" },
      { adm: "TIP-003", name: "Sneha Yadav", classCode: "Y2", father: "Ramesh Yadav", phone: "9000000013" },
    ],
  },
  {
    schoolId: TCMBSP,
    label: "Tagore College of Management",
    rows: [
      { adm: "TCM-001", name: "Rohan Gupta", classCode: "Y1", father: "Anil Gupta", phone: "9000000021" },
      { adm: "TCM-002", name: "Ananya Rao", classCode: "Y1", father: "Prakash Rao", phone: "9000000022" },
      { adm: "TCM-003", name: "Vikram Das", classCode: "Y2", father: "Bipin Das", phone: "9000000023" },
    ],
  },
];

async function main() {
  for (const inst of STUDENTS) {
    console.log(`\n=== ${inst.label} ===`);

    // Map class code → id for this school.
    const { data: classes } = await db
      .from("classes")
      .select("id, code")
      .eq("school_id", inst.schoolId);
    const classId = new Map((classes ?? []).map((c) => [c.code as string, c.id as string]));

    for (const s of inst.rows) {
      const { data: existing } = await db
        .from("students")
        .select("id")
        .eq("admission_no", s.adm)
        .maybeSingle();
      if (existing) {
        console.log(`  = ${s.name} (${s.adm}) exists, skipped`);
        continue;
      }
      const cid = classId.get(s.classCode);
      if (!cid) {
        console.error(`  ! ${s.name}: class ${s.classCode} not found for this institute`);
        continue;
      }
      const { error } = await db.from("students").insert({
        school_id: inst.schoolId,
        admission_no: s.adm,
        full_name: s.name,
        class_id: cid,
        section: "A",
        father_name: s.father,
        contact_number: s.phone,
        status: "active",
        is_new_admission: false,
        is_hosteller: false,
      });
      if (error) {
        console.error(`  ! ${s.name}: ${error.message}`);
        continue;
      }
      console.log(`  + ${s.name} (${s.adm}) → ${s.classCode}`);
    }
  }
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
