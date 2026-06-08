"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole, getCurrentSchoolId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

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
  return { ok: true, updated };
}
