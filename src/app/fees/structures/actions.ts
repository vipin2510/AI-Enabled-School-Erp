"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole, getCurrentSchoolId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { bustTag, tagFor } from "@/lib/cache/index";
import { currentAcademicYear } from "@/lib/academic-year";

// Payload shape sent by the structures editor. Every component update names
// the structure it belongs to so the server can verify ownership before
// touching the row — without this, a session in one tenant could update any
// component id from any other tenant.
const Updates = z.object({
  components: z
    .array(
      z.object({
        structure_id: z.string().uuid(),
        component_id: z.string().uuid(),
        amount: z.number().nonnegative(),
      }),
    )
    .max(2000),
  structures: z
    .array(
      z.object({
        structure_id: z.string().uuid(),
        total_amount: z.number().nonnegative(),
      }),
    )
    .max(500),
});

export type StructuresSaveResult =
  | { ok: true; updated: number }
  | { ok: false; error: string };

// Apply a batch of edits from the structures editor.
//
// Authorization model:
//   - admin/manager only (Layer 1/2) — staff are bounced
//   - every structure_id is verified against the caller's school_id
//   - every component_id must belong to a verified structure
// Anything that fails ownership is dropped silently so a tampered payload
// can't poison legitimate edits — we still report the count actually written.
export async function saveStructureUpdates(payload: unknown): Promise<StructuresSaveResult> {
  const profile = await requireRole("admin", "manager");
  const schoolId = await getCurrentSchoolId(profile);

  const parsed = Updates.safeParse(payload);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const { components, structures } = parsed.data;

  const supabase = await createClient();

  const structureIds = Array.from(
    new Set([
      ...components.map((c) => c.structure_id),
      ...structures.map((s) => s.structure_id),
    ]),
  );

  if (structureIds.length === 0) return { ok: true, updated: 0 };

  // Verify every structure belongs to this school.
  const { data: owned, error: ownedErr } = await supabase
    .from("fee_structures")
    .select("id")
    .eq("school_id", schoolId)
    .in("id", structureIds);
  if (ownedErr) return { ok: false, error: ownedErr.message };
  const ownedSet = new Set((owned ?? []).map((r) => r.id));

  // Drop any update targeting a structure outside this school.
  const safeComponents = components.filter((c) => ownedSet.has(c.structure_id));
  const safeStructures = structures.filter((s) => ownedSet.has(s.structure_id));

  // Verify each component_id actually belongs to one of those structures.
  if (safeComponents.length) {
    const compIds = Array.from(new Set(safeComponents.map((c) => c.component_id)));
    const { data: comps, error: compErr } = await supabase
      .from("fee_structure_components")
      .select("id, structure_id")
      .in("id", compIds);
    if (compErr) return { ok: false, error: compErr.message };
    const compToStruct = new Map(
      (comps ?? []).map((c) => [c.id, (c as { structure_id: string }).structure_id]),
    );
    for (let i = safeComponents.length - 1; i >= 0; i--) {
      const c = safeComponents[i];
      if (compToStruct.get(c.component_id) !== c.structure_id) {
        safeComponents.splice(i, 1);
      }
    }
  }

  let updated = 0;
  for (const c of safeComponents) {
    const { error } = await supabase
      .from("fee_structure_components")
      .update({ amount: c.amount })
      .eq("id", c.component_id)
      .eq("structure_id", c.structure_id);
    if (error) return { ok: false, error: error.message };
    updated += 1;
  }
  for (const s of safeStructures) {
    const { error } = await supabase
      .from("fee_structures")
      .update({ total_amount: s.total_amount })
      .eq("id", s.structure_id)
      .eq("school_id", schoolId);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/fees/structures");
  // Bust the cached fee_structures bundle so the Collect Fee picker, Fees
  // dashboard, and Overview pick up the new amounts on their very next render
  // (instead of waiting up to 10 min for the TTL to elapse).
  await bustTag(tagFor.feeStructures(schoolId));
  return { ok: true, updated };
}

// Add an empty hostel fee structure (group_label × student_kind) for the
// current academic year. Mirrors the seed shape from migration 0002:
// "new" students get registration + caution + 4 instalments, "old" students
// get the 4 instalments only. All amounts default to 0 — admin/manager
// fills them in via the editor below. Silently no-ops on duplicate
// (group_label, kind) for this school + AY.
export async function addHostelStructure(formData: FormData) {
  const profile = await requireRole("admin", "manager");
  const schoolId = await getCurrentSchoolId(profile);

  const group_label = String(formData.get("group_label") ?? "").trim();
  const kindRaw = String(formData.get("student_kind") ?? "");
  const student_kind = kindRaw === "old" ? "old" : "new";
  if (!group_label) return;

  const supabase = await createClient();
  const ay = currentAcademicYear();

  const { data: fs, error } = await supabase
    .from("fee_structures")
    .insert({
      academic_year: ay,
      scope: "hostel",
      class_id: null,
      group_label,
      student_kind,
      total_amount: 0,
      school_id: schoolId,
    })
    .select("id")
    .single();
  if (error || !fs) {
    revalidatePath("/fees/structures");
    return;
  }

  const ordinals = ["1st", "2nd", "3rd", "4th"];
  const instalments = [1, 2, 3, 4].map((n) => ({
    structure_id: fs.id,
    kind: "instalment",
    label: `${ordinals[n - 1]} Instalment`,
    period_index: n,
    amount: 0,
    is_refundable: false,
    is_one_time: false,
    sort_order: 10 + n - 1,
    school_id: schoolId,
  }));

  const baseRows =
    student_kind === "new"
      ? [
          {
            structure_id: fs.id, kind: "registration", label: "Hostel Registration Fee",
            period_index: null, amount: 0, is_refundable: false, is_one_time: true,
            sort_order: 0, school_id: schoolId,
          },
          {
            structure_id: fs.id, kind: "caution", label: "Hostel Caution Money",
            period_index: null, amount: 0, is_refundable: true, is_one_time: true,
            sort_order: 1, school_id: schoolId,
          },
        ]
      : [];

  await supabase
    .from("fee_structure_components")
    .insert([...baseRows, ...instalments]);

  revalidatePath("/fees/structures");
  await bustTag(tagFor.feeStructures(schoolId));
}
