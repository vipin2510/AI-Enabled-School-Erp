"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { marksOwnAttendance } from "@/lib/access";
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
    },
    { onConflict: "profile_id,date" }
  );
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { markedAt: now };
}
