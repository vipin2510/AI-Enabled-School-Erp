"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole, getCurrentSchoolId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Permanently delete a receipt (invoice). Admin only. The invoice's line items
// and payment rows are removed automatically by ON DELETE CASCADE. Scoped to
// the caller's active school so an admin can't delete another school's receipt.
export async function deleteReceipt(formData: FormData) {
  const profile = await requireRole("admin");
  const schoolId = await getCurrentSchoolId(profile);
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("invoices")
    .delete()
    .eq("school_id", schoolId)
    .eq("id", id);
  if (error) throw error;

  revalidatePath("/receipts");
  revalidatePath("/fees");
  redirect("/receipts");
}
