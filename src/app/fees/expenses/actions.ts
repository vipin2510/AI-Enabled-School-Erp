"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireDepartment, requireRole, getCurrentSchoolId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const SubmitSchema = z.object({
  amount: z.number().positive("Amount must be greater than 0."),
  category: z.string().trim().nullable(),
  description: z.string().trim().min(1, "Describe the expense briefly."),
  spent_on: z.string().trim().nullable(),
});

export type SubmitState = { error?: string; success?: string } | undefined;

// Anyone in the fees department (staff, manager, admin) can submit an
// expense; admin/manager can do it from any department since they're
// cross-dept.
export async function submitExpense(
  _prev: SubmitState,
  formData: FormData
): Promise<SubmitState> {
  const profile = await requireDepartment("fees");
  const schoolId = await getCurrentSchoolId(profile);

  const amountRaw = String(formData.get("amount") ?? "").trim();
  const amount = amountRaw === "" ? NaN : Number(amountRaw);
  const blank = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v === "" ? null : v;
  };

  const parsed = SubmitSchema.safeParse({
    amount: Number.isFinite(amount) ? amount : NaN,
    category: blank("category"),
    description: String(formData.get("description") ?? "").trim(),
    spent_on: blank("spent_on"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("expenses").insert({
    school_id: schoolId,
    raised_by: profile.id,
    amount: parsed.data.amount,
    category: parsed.data.category,
    description: parsed.data.description,
    spent_on: parsed.data.spent_on,
    status: "pending",
  });
  if (error) return { error: error.message };

  revalidatePath("/fees/expenses");
  return { success: "Submitted for approval." };
}

// Admin-only decision: approve or decline a pending expense.
// Once decided, the row is immutable from the UI — to undo, raise a new one.
export async function decideExpense(formData: FormData) {
  const profile = await requireRole("admin");
  const schoolId = await getCurrentSchoolId(profile);
  const id = String(formData.get("id") ?? "");
  const decisionRaw = String(formData.get("decision") ?? "");
  const note = String(formData.get("decision_note") ?? "").trim();
  if (!id || (decisionRaw !== "approve" && decisionRaw !== "decline")) return;

  const supabase = await createClient();
  // Only update if currently pending — guards against a double-click race.
  const { error } = await supabase
    .from("expenses")
    .update({
      status: decisionRaw === "approve" ? "approved" : "declined",
      decided_by: profile.id,
      decided_at: new Date().toISOString(),
      decision_note: note === "" ? null : note,
    })
    .eq("school_id", schoolId)
    .eq("id", id)
    .eq("status", "pending");
  if (error) return;

  revalidatePath("/fees/expenses");
}
