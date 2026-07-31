"use server";

import { revalidatePath } from "next/cache";
import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type SetBusFeeState = { error?: string; saved?: boolean } | undefined;

export type SetFeeKindState = { error?: string; saved?: boolean } | undefined;

// Set a student's fee kind (new/old), which gates whether one-time charges
// (registration/admission) apply. Chosen once by any fees user; changing it
// afterwards is admin-only (so a cashier can't silently drop admission fees).
export async function setFeeKind(
  _prev: SetFeeKindState,
  formData: FormData,
): Promise<SetFeeKindState> {
  const profile = await requireDepartment("fees");
  const schoolId = await getCurrentSchoolId(profile);

  const studentId = String(formData.get("student_id") ?? "").trim();
  const kind = String(formData.get("fee_kind") ?? "").trim();
  if (!studentId) return { error: "Missing student." };
  if (kind !== "new" && kind !== "old") return { error: "Pick New or Old." };

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("students")
    .select("fee_kind")
    .eq("school_id", schoolId)
    .eq("id", studentId)
    .maybeSingle();

  // Once set, only an admin may change it to a different value.
  const existing = (current as { fee_kind?: string | null } | null)?.fee_kind ?? null;
  if (existing && existing !== kind && profile.role !== "admin") {
    return { error: "Only an admin can change a student's fee type once set." };
  }

  const { error } = await supabase
    .from("students")
    .update({ fee_kind: kind })
    .eq("school_id", schoolId)
    .eq("id", studentId);
  if (error) return { error: error.message };

  revalidatePath(`/fees/collect/${studentId}`);
  return { saved: true };
}

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
