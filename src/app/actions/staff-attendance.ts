"use server";

import { revalidatePath } from "next/cache";
import { requireProfile, getCurrentSchoolId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { marksOwnAttendance } from "@/lib/access";
import { bustTag, tagFor } from "@/lib/cache/index";
import { todayStr } from "@/lib/attendance";

export type MarkState = { error?: string; markedAt?: string } | undefined;

// Layer 2/3 mark themselves present for today. The browser supplies the
// geolocation (it can't be read server-side); we stamp the time here. Upsert on
// (profile, date) so a second tap just refreshes the location.
export async function markStaffAttendance(
  coords: { latitude: number; longitude: number; accuracy: number } | null
): Promise<MarkState> {
  const profile = await requireProfile();
  if (!marksOwnAttendance(profile.role)) return { error: "Not allowed." };
  const schoolId = await getCurrentSchoolId(profile);

  const now = new Date().toISOString();
  const supabase = await createClient();
  const { error } = await supabase.from("staff_attendance").upsert(
    {
      profile_id: profile.id,
      date: todayStr(),
      marked_at: now,
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
      accuracy: coords?.accuracy ?? null,
      school_id: schoolId,
    },
    { onConflict: "profile_id,date" }
  );
  if (error) return { error: error.message };

  // Layout caches "marked today?" for 60s per user. Bust it so the topbar
  // flips from "Mark attendance" → "Marked at …" on the next navigation.
  await bustTag(tagFor.staffAttendance(schoolId, profile.id, todayStr()));
  revalidatePath("/", "layout");
  return { markedAt: now };
}
