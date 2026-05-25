"use server";

import { revalidatePath } from "next/cache";
import { requireProfile, requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type RequestState = { error?: string; success?: string } | undefined;

// Layer 2 (and admins) raise a change request to the admin.
export async function submitRequest(
  _prev: RequestState,
  formData: FormData
): Promise<RequestState> {
  const profile = await requireProfile();
  if (profile.role === "staff") return { error: "Not allowed." };

  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!subject || !body) return { error: "Subject and details are required." };

  const supabase = await createClient();
  const { error } = await supabase.from("change_requests").insert({
    requested_by: profile.id,
    requester_email: profile.email,
    subject,
    body,
  });
  if (error) return { error: error.message };

  revalidatePath("/requests");
  return { success: "Request sent to the administrator." };
}

// Admin resolves a request.
export async function resolveRequest(formData: FormData) {
  await requireRole("admin");
  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("admin_note") ?? "").trim() || null;
  if (!id) return;

  const supabase = await createClient();
  await supabase
    .from("change_requests")
    .update({ status: "resolved", admin_note: note, resolved_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/requests");
}
