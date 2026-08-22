import type { createClient } from "@/lib/supabase/server";
import { getCashbookSettings } from "@/lib/cache";
import { addDays } from "@/lib/attendance";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export const MODE_LABEL: Record<string, string> = {
  cash: "Cash",
  cheque: "Cheque",
  upi: "UPI",
  inb: "Internet Banking",
  card: "Card",
  bank: "Bank Transfer",
};

// IST day boundary as an absolute instant, so timestamptz columns filter by the
// correct calendar day regardless of server timezone.
const dayStartISO = (d: string) => `${d}T00:00:00+05:30`;

export type CashCollectionMode = { mode: string; count: number; amount: number };
export type CashReceipt = {
  receipt_no: string | null;
  payment_mode: string | null;
  amount_paid: number;
  issued_at: string;
  student_name: string | null;
};
export type CashExpenseRow = {
  description: string;
  category: string | null;
  amount: number;
  source: "approved" | "cashbook";
  mode: string;
};
export type CashDeposit = {
  bank_name: string | null;
  deposit_receipt_no: string | null;
  reference: string | null;
  amount: number;
};
export type CashbookDay = {
  date: string;
  openingBalance: number;
  openingDateSet: boolean;
  opening: number;
  collections: { list: CashReceipt[]; byMode: CashCollectionMode[]; total: number; cash: number };
  expenses: { list: CashExpenseRow[]; cashTotal: number; total: number };
  deposits: { list: CashDeposit[]; total: number };
  closing: number;
};

async function sumPages(
  fetchPage: (from: number, to: number) => Promise<number[]>,
): Promise<number> {
  const PAGE = 1000;
  let total = 0;
  for (let from = 0; ; from += PAGE) {
    const nums = await fetchPage(from, from + PAGE - 1);
    for (const n of nums) total += n;
    if (nums.length < PAGE) break;
  }
  return total;
}

// One day's cashbook. Cash-in-hand subtracts BOTH approved expenses (from the
// dedicated Expenses page — approved expenses are treated as cash outflow) AND
// any legacy `cashbook_expenses` rows (so historical closing balances entered
// before the Expenses page became the source of truth don't shift). Only cash
// collections affect cash-in-hand; UPI/cheque/bank go to the bank.
export async function getCashbookDay(
  supabase: ServerClient,
  schoolId: string,
  day: string,
): Promise<CashbookDay> {
  const settings = await getCashbookSettings(schoolId);
  const floor = settings.opening_date ?? "1970-01-01";
  const next = addDays(day, 1);

  // --- Running opening cash: anchor + (cash in − cash out) before the day ---
  const cashInBefore = await sumPages(async (from, to) => {
    const { data, error } = await supabase
      .from("invoices").select("amount_paid")
      .eq("school_id", schoolId).eq("payment_mode", "cash").neq("payment_status", "void")
      .gte("issued_at", dayStartISO(floor)).lt("issued_at", dayStartISO(day))
      .range(from, to);
    if (error) throw error;
    return ((data ?? []) as { amount_paid: number | string }[]).map((r) => Number(r.amount_paid) || 0);
  });
  const legacyExpBefore = await sumPages(async (from, to) => {
    const { data, error } = await supabase
      .from("cashbook_expenses").select("amount")
      .eq("school_id", schoolId).eq("mode", "cash")
      .gte("spent_on", floor).lt("spent_on", day).range(from, to);
    if (error) return []; // table may not exist on pre-migration deployments
    return ((data ?? []) as { amount: number | string }[]).map((r) => Number(r.amount) || 0);
  });
  const approvedExpBefore = await sumPages(async (from, to) => {
    const { data, error } = await supabase
      .from("expenses").select("amount")
      .eq("school_id", schoolId).eq("status", "approved")
      .gte("spent_on", floor).lt("spent_on", day).range(from, to);
    if (error) return [];
    return ((data ?? []) as { amount: number | string }[]).map((r) => Number(r.amount) || 0);
  });
  const depositsBefore = await sumPages(async (from, to) => {
    const { data, error } = await supabase
      .from("bank_deposits").select("amount")
      .eq("school_id", schoolId)
      .gte("deposited_on", floor).lt("deposited_on", day).range(from, to);
    if (error) return [];
    return ((data ?? []) as { amount: number | string }[]).map((r) => Number(r.amount) || 0);
  });
  const opening =
    Number(settings.opening_balance) + cashInBefore - legacyExpBefore - approvedExpBefore - depositsBefore;

  // --- The selected day ---
  const [collRes, apprRes, legacyRes, depRes] = await Promise.all([
    supabase
      .from("invoices")
      .select("receipt_no, payment_mode, amount_paid, issued_at, students(full_name)")
      .eq("school_id", schoolId).neq("payment_status", "void")
      .gte("issued_at", dayStartISO(day)).lt("issued_at", dayStartISO(next))
      .order("issued_at", { ascending: false }),
    supabase
      .from("expenses")
      .select("description, category, amount")
      .eq("school_id", schoolId).eq("status", "approved").eq("spent_on", day)
      .order("created_at", { ascending: false }),
    supabase
      .from("cashbook_expenses")
      .select("description, category, mode, amount")
      .eq("school_id", schoolId).eq("spent_on", day)
      .order("created_at", { ascending: false }),
    supabase
      .from("bank_deposits")
      .select("amount, bank_name, deposit_receipt_no, reference")
      .eq("school_id", schoolId).eq("deposited_on", day)
      .order("created_at", { ascending: false }),
  ]);
  if (collRes.error) throw collRes.error; // invoices always exist — surface outages

  const rawColl = (collRes.data ?? []) as unknown as {
    receipt_no: string | null;
    payment_mode: string | null;
    amount_paid: number | string;
    issued_at: string;
    students: { full_name: string } | null;
  }[];
  const list: CashReceipt[] = rawColl.map((c) => ({
    receipt_no: c.receipt_no,
    payment_mode: c.payment_mode,
    amount_paid: Number(c.amount_paid) || 0,
    issued_at: c.issued_at,
    student_name: c.students?.full_name ?? null,
  }));
  const byModeMap = new Map<string, CashCollectionMode>();
  for (const c of list) {
    const m = c.payment_mode ?? "cash";
    const cur = byModeMap.get(m) ?? { mode: m, count: 0, amount: 0 };
    cur.count += 1;
    cur.amount += c.amount_paid;
    byModeMap.set(m, cur);
  }
  const totalCollections = list.reduce((s, c) => s + c.amount_paid, 0);
  const cashCollections = byModeMap.get("cash")?.amount ?? 0;

  const approved = ((apprRes.data ?? []) as { description: string; category: string | null; amount: number | string }[])
    .map((e): CashExpenseRow => ({
      description: e.description,
      category: e.category,
      amount: Number(e.amount) || 0,
      source: "approved",
      mode: "cash",
    }));
  const legacy = ((legacyRes.error ? [] : legacyRes.data ?? []) as {
    description: string; category: string | null; mode: string; amount: number | string;
  }[]).map((e): CashExpenseRow => ({
    description: e.description,
    category: e.category,
    amount: Number(e.amount) || 0,
    source: "cashbook",
    mode: e.mode,
  }));
  const expenseList = [...approved, ...legacy];
  const expenseTotal = expenseList.reduce((s, e) => s + e.amount, 0);
  const expenseCashTotal = expenseList
    .filter((e) => e.mode === "cash")
    .reduce((s, e) => s + e.amount, 0);

  const deposits = ((depRes.error ? [] : depRes.data ?? []) as {
    amount: number | string; bank_name: string | null; deposit_receipt_no: string | null; reference: string | null;
  }[]).map((d): CashDeposit => ({
    amount: Number(d.amount) || 0,
    bank_name: d.bank_name,
    deposit_receipt_no: d.deposit_receipt_no,
    reference: d.reference,
  }));
  const depositsDay = deposits.reduce((s, d) => s + d.amount, 0);

  const closing = opening + cashCollections - expenseCashTotal - depositsDay;

  return {
    date: day,
    openingBalance: Number(settings.opening_balance),
    openingDateSet: !!settings.opening_date,
    opening,
    collections: {
      list,
      byMode: [...byModeMap.values()],
      total: totalCollections,
      cash: cashCollections,
    },
    expenses: { list: expenseList, cashTotal: expenseCashTotal, total: expenseTotal },
    deposits: { list: deposits, total: depositsDay },
    closing,
  };
}
