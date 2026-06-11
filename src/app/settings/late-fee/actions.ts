"use server";

import { revalidatePath } from "next/cache";
import { requireRole, getCurrentSchoolId } from "@/lib/auth";
import { bustTag, tagFor } from "@/lib/cache/index";

// Late-fee settings are cached for 30 minutes on the Collect Fee page; this
// action exists so the settings form can flip the cache as soon as a leader
// saves, without waiting for the TTL. Permission gate matches the settings
// page itself — admin/manager only — so a staff session can't preemptively
// expire caches as a DoS vector.
export async function bustLateFeeCache(): Promise<{ ok: true } | { ok: false; error: string }> {
  const profile = await requireRole("admin", "manager");
  const schoolId = await getCurrentSchoolId(profile);
  await bustTag(tagFor.lateFeeSettings(schoolId));
  revalidatePath("/fees/collect", "layout");
  return { ok: true };
}
