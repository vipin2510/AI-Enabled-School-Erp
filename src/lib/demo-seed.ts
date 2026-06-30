// Per-visitor demo school: clone the read-only template (seeded by
// 0027_demo_template.sql) into a fresh ephemeral school, and tear it back down.
// Both run with whatever Supabase client is passed in (anon for start/exit —
// RLS is permissive; service-role for the cleanup sweeper). Every demo row is
// scoped by `school_id`, so isolation is automatic.

import type { SupabaseClient } from "@supabase/supabase-js";
import { TEMPLATE_SCHOOL_ID } from "@/lib/demo";
import { currentAcademicYear } from "@/lib/academic-year";

// Child tables that carry school_id, in FK-safe delete order (children first).
// The schools row itself is deleted last by the caller.
const TEARDOWN_ORDER = [
  "payments",
  "invoice_items",
  "invoices",
  "attendance",
  "marks",
  "co_curricular_grades",
  "book_loans",
  "book_requests",
  "books",
  "library_settings",
  "staff_attendance",
  "change_requests",
  "fee_structure_components",
  "fee_structures",
  "students",
  "subjects",
  "sections",
  "late_fee_settings",
  "classes",
] as const;

type Row = Record<string, unknown>;

// Copy template rows for one table into the demo school, remapping ids.
async function cloneTable(
  supabase: SupabaseClient,
  table: string,
  columns: string,
  map: (row: Row) => Row | null,
): Promise<Row[]> {
  const { data, error } = await supabase
    .from(table)
    .select(columns)
    .eq("school_id", TEMPLATE_SCHOOL_ID);
  if (error) throw new Error(`demo clone read ${table}: ${error.message}`);
  const rows = ((data ?? []) as unknown as Row[])
    .map(map)
    .filter((r): r is Row => r !== null);
  if (rows.length) {
    // Untyped supabase-js client → insert row type is `never`; cast the rows.
    const { error: insErr } = await supabase.from(table).insert(rows as never);
    if (insErr) throw new Error(`demo clone write ${table}: ${insErr.message}`);
  }
  return rows;
}

export async function cloneTemplateSchool(
  supabase: SupabaseClient,
  demoSchoolId: string,
): Promise<void> {
  const ay = currentAcademicYear();
  const classMap = new Map<string, string>(); // template class id → demo class id
  const structMap = new Map<string, string>(); // template structure id → demo

  // 1. classes
  await cloneTable(
    supabase,
    "classes",
    "id, code, display_name, ordinal, stream, group_label",
    (c) => {
      const id = crypto.randomUUID();
      classMap.set(c.id as string, id);
      return {
        id,
        school_id: demoSchoolId,
        code: c.code,
        display_name: c.display_name,
        ordinal: c.ordinal,
        stream: c.stream,
        group_label: c.group_label,
      };
    },
  );

  // 2. sections / 3. subjects (same shape, remap class_id)
  for (const table of ["sections", "subjects"]) {
    await cloneTable(supabase, table, "class_id, name", (r) => {
      const classId = classMap.get(r.class_id as string);
      if (!classId) return null;
      return { id: crypto.randomUUID(), school_id: demoSchoolId, class_id: classId, name: r.name };
    });
  }

  // 4. fee_structures (remap class_id; restamp to current academic year)
  await cloneTable(
    supabase,
    "fee_structures",
    "id, scope, class_id, group_label, student_kind, total_amount",
    (fs) => {
      const id = crypto.randomUUID();
      structMap.set(fs.id as string, id);
      return {
        id,
        school_id: demoSchoolId,
        academic_year: ay,
        scope: fs.scope,
        class_id: fs.class_id ? classMap.get(fs.class_id as string) ?? null : null,
        group_label: fs.group_label,
        student_kind: fs.student_kind,
        total_amount: fs.total_amount,
      };
    },
  );

  // 5. fee_structure_components (remap structure_id)
  await cloneTable(
    supabase,
    "fee_structure_components",
    "structure_id, kind, label, period_index, amount, due_date, is_refundable, is_one_time, sort_order",
    (c) => {
      const structureId = structMap.get(c.structure_id as string);
      if (!structureId) return null;
      return {
        id: crypto.randomUUID(),
        school_id: demoSchoolId,
        structure_id: structureId,
        kind: c.kind,
        label: c.label,
        period_index: c.period_index,
        amount: c.amount,
        due_date: c.due_date,
        is_refundable: c.is_refundable,
        is_one_time: c.is_one_time,
        sort_order: c.sort_order,
      };
    },
  );

  // 6. late_fee_settings (single row)
  await cloneTable(
    supabase,
    "late_fee_settings",
    "per_day_amount, grace_days, is_enabled",
    (l) => ({
      id: crypto.randomUUID(),
      school_id: demoSchoolId,
      per_day_amount: l.per_day_amount,
      grace_days: l.grace_days,
      is_enabled: l.is_enabled,
    }),
  );

  // 7. students (remap class_id; drop admission_no — it's globally unique)
  await cloneTable(
    supabase,
    "students",
    "full_name, class_id, section, gender, blood_group, date_of_birth, father_name, mother_name, contact_number, alt_contact, address, is_hosteller, is_new_admission, bus_fee_amount, status",
    (s) => ({
      id: crypto.randomUUID(),
      school_id: demoSchoolId,
      full_name: s.full_name,
      class_id: s.class_id ? classMap.get(s.class_id as string) ?? null : null,
      section: s.section,
      gender: s.gender,
      blood_group: s.blood_group,
      date_of_birth: s.date_of_birth,
      father_name: s.father_name,
      mother_name: s.mother_name,
      contact_number: s.contact_number,
      alt_contact: s.alt_contact,
      address: s.address,
      is_hosteller: s.is_hosteller,
      is_new_admission: s.is_new_admission,
      bus_fee_amount: s.bus_fee_amount,
      status: s.status,
    }),
  );
}

// Delete every row for a demo school (children first) then the school itself.
// FK-safe so the final schools delete (ON DELETE RESTRICT children) succeeds.
export async function teardownDemoSchool(
  supabase: SupabaseClient,
  demoSchoolId: string,
): Promise<void> {
  for (const table of TEARDOWN_ORDER) {
    const { error } = await supabase.from(table).delete().eq("school_id", demoSchoolId);
    // Ignore "table/column missing" style errors so teardown is resilient to
    // schema drift; rethrow real failures would just block cleanup.
    if (error && !/does not exist|column/i.test(error.message)) {
      throw new Error(`demo teardown ${table}: ${error.message}`);
    }
  }
  const { error } = await supabase.from("schools").delete().eq("id", demoSchoolId);
  if (error) throw new Error(`demo teardown schools: ${error.message}`);
}
