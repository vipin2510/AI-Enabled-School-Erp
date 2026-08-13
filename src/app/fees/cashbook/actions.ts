"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireDepartment, requireRole, getCurrentSchoolId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { bustTag } from "@/lib/cache/index";
import { tagFor } from "@/lib/cache";

export type CashbookState = { error?: string; success?: string } | undefined;

const blank = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
};
const amountOf = (fd: FormData) => {
  const raw = String(fd.get("amount") ?? "").trim();
  return raw === "" ? NaN : Number(raw);
};

const ExpenseSchema = z.object({
  amount: z.number().positive("Amount must be greater than 0."),
  mode: z.enum(["cash", "cheque", "upi", "inb"]),
  category: z.string().trim().nullable(),
  description: z.string().trim().min(1, "Describe the expense briefly."),
  spent_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date."),
});

// Record an office expense in the cashbook. Anyone in the fees department.
export async function addExpense(_prev: CashbookState, fd: FormData): Promise<CashbookState> {
  const profile = await requireDepartment("fees");
  const schoolId = await getCurrentSchoolId(profile);

  const parsed = ExpenseSchema.safeParse({
    amount: Number.isFinite(amountOf(fd)) ? amountOf(fd) : NaN,
    mode: String(fd.get("mode") ?? "cash"),
    category: blank(fd, "category"),
    description: String(fd.get("description") ?? "").trim(),
    spent_on: String(fd.get("spent_on") ?? "").trim(),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const supabase = await createClient();
  const { error } = await supabase.from("cashbook_expenses").insert({
    school_id: schoolId,
    spent_on: parsed.data.spent_on,
    mode: parsed.data.mode,
    category: parsed.data.category,
    description: parsed.data.description,
    amount: parsed.data.amount,
    created_by: profile.full_name || null,
  });
  if (error) return { error: error.message };

  revalidatePath("/fees/cashbook");
  return { success: "Expense recorded." };
}

const DepositSchema = z.object({
  amount: z.number().positive("Amount must be greater than 0."),
  deposited_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date."),
  bank_name: z.string().trim().nullable(),
  deposit_receipt_no: z.string().trim().nullable(),
  reference: z.string().trim().nullable(),
  notes: z.string().trim().nullable(),
});

// Record cash deposited into the bank (reduces cash-in-hand). Fees department.
export async function addDeposit(_prev: CashbookState, fd: FormData): Promise<CashbookState> {
  const profile = await requireDepartment("fees");
  const schoolId = await getCurrentSchoolId(profile);

  const parsed = DepositSchema.safeParse({
    amount: Number.isFinite(amountOf(fd)) ? amountOf(fd) : NaN,
    deposited_on: String(fd.get("deposited_on") ?? "").trim(),
    bank_name: blank(fd, "bank_name"),
    deposit_receipt_no: blank(fd, "deposit_receipt_no"),
    reference: blank(fd, "reference"),
    notes: blank(fd, "notes"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const supabase = await createClient();
  const { error } = await supabase.from("bank_deposits").insert({
    school_id: schoolId,
    deposited_on: parsed.data.deposited_on,
    amount: parsed.data.amount,
    bank_name: parsed.data.bank_name,
    deposit_receipt_no: parsed.data.deposit_receipt_no,
    reference: parsed.data.reference,
    notes: parsed.data.notes,
    created_by: profile.full_name || null,
  });
  if (error) return { error: error.message };

  revalidatePath("/fees/cashbook");
  return { success: "Deposit recorded." };
}

const OpeningSchema = z.object({
  opening_balance: z.number().nonnegative("Opening balance can't be negative."),
  opening_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the opening date."),
});

// Set the per-school opening cash balance (e.g. 1 April). Admin only — this is
// the anchor the whole running cash-in-hand is derived from.
export async function setOpeningBalance(_prev: CashbookState, fd: FormData): Promise<CashbookState> {
  const profile = await requireRole("admin");
  const schoolId = await getCurrentSchoolId(profile);

  const raw = String(fd.get("opening_balance") ?? "").trim();
  const parsed = OpeningSchema.safeParse({
    opening_balance: raw === "" ? NaN : Number(raw),
    opening_date: String(fd.get("opening_date") ?? "").trim(),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const supabase = await createClient();
  const { error } = await supabase.from("cashbook_settings").upsert(
    {
      school_id: schoolId,
      opening_balance: parsed.data.opening_balance,
      opening_date: parsed.data.opening_date,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "school_id" },
  );
  if (error) return { error: error.message };

  await bustTag(tagFor.cashbookSettings(schoolId));
  revalidatePath("/fees/cashbook");
  return { success: "Opening balance saved." };
}
