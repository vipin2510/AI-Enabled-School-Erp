"use server";

import { revalidatePath } from "next/cache";
import { requireRole, getCurrentSchoolId } from "@/lib/auth";
import { bustTag, tagFor } from "@/lib/cache/index";

// The receipt PDF route caches the layout for 30 min; this action lets the
// settings form flush it the instant a leader saves, so the next Preview /
// Download reflects the new layout. Permission gate matches the settings page
// — admin/manager only — so a staff session can't expire caches as a DoS.
export async function bustFeePrintCache(): Promise<{ ok: true } | { ok: false; error: string }> {
  const profile = await requireRole("admin", "manager");
  const schoolId = await getCurrentSchoolId(profile);
  await bustTag(tagFor.feePrintSettings(schoolId));
  revalidatePath("/receipts", "layout");
  return { ok: true };
}
