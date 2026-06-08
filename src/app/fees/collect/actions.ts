"use server";

import { revalidatePath } from "next/cache";
import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type SetBusFeeState = { error?: string; saved?: boolean } | undefined;

// Set or clear a student's per-month bus fee from the Collect Fee picker.
// Empty / "0" clears it (student is not on the bus); a positive integer enrolls
// them at that monthly rate, which the collect form then multiplies by the
// number of monthly slots selected.
export async function setBusFee(
  _prev: SetBusFeeState,
  formData: FormData,
): Promise<SetBusFeeState> {
  const profile = await requireDepartment("fees");
  const schoolId = await getCurrentSchoolId(profile);

  const studentId = String(formData.get("student_id") ?? "").trim();
  if (!studentId) return { error: "Missing student." };

  const raw = String(formData.get("amount") ?? "").trim();
  let amount: number | null;
  if (raw === "" || raw === "0") {
    amount = null;
  } else {
    const n = Number(raw);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
      return { error: "Enter a whole rupee amount." };
    }
    amount = n;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("students")
    .update({ bus_fee_amount: amount })
    .eq("school_id", schoolId)
    .eq("id", studentId);
  if (error) return { error: error.message };

  revalidatePath("/fees/collect");
  revalidatePath(`/fees/collect/${studentId}`);
  return { saved: true };
}
