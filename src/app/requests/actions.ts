"use server";

import { revalidatePath } from "next/cache";
import { requireProfile, requireRole, getCurrentSchoolId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type RequestState = { error?: string; success?: string } | undefined;

// Any logged-in user raises a change request to the admin.
export async function submitRequest(
  _prev: RequestState,
  formData: FormData
): Promise<RequestState> {
  const profile = await requireProfile();
  const schoolId = await getCurrentSchoolId(profile);

  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!subject || !body) return { error: "Subject and details are required." };

  const supabase = await createClient();
  const { error } = await supabase.from("change_requests").insert({
    requested_by: profile.id,
    requester_email: profile.email,
    subject,
    body,
    school_id: schoolId,
  });
  if (error) return { error: error.message };

  revalidatePath("/requests");
  return { success: "Request sent to the administrator." };
}

// Admin resolves a request.
export async function resolveRequest(formData: FormData) {
  const profile = await requireRole("admin");
  const schoolId = await getCurrentSchoolId(profile);
  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("admin_note") ?? "").trim() || null;
  if (!id) return;

  const supabase = await createClient();
  await supabase
    .from("change_requests")
    .update({ status: "resolved", admin_note: note, resolved_at: new Date().toISOString() })
    .eq("id", id)
    .eq("school_id", schoolId);
  revalidatePath("/requests");
}
