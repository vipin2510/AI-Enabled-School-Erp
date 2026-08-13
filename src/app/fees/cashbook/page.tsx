import Link from "next/link";
import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { inr } from "@/lib/utils";
import { todayStr, addDays, prettyDate } from "@/lib/attendance";
import { getCashbookSettings } from "@/lib/cache";
import { ExpenseForm, DepositForm, OpeningBalanceForm } from "./cashbook-forms";

export const dynamic = "force-dynamic";

// IST day boundary as an absolute instant, so a `date` (timestamptz) column is
// filtered by the correct calendar day regardless of server timezone.
const dayStartISO = (d: string) => `${d}T00:00:00+05:30`;

const MODE_LABEL: Record<string, string> = {
  cash: "Cash", cheque: "Cheque", upi: "UPI", inb: "Internet Banking", card: "Card", bank: "Bank Transfer",
};

async function sumPages(fetchPage: (from: number, to: number) => Promise<number[]>): Promise<number> {
  const PAGE = 1000;
  let total = 0;
  for (let from = 0; ; from += PAGE) {
    const nums = await fetchPage(from, from + PAGE - 1);
    for (const n of nums) total += n;
    if (nums.length < PAGE) break;
  }
  return total;
}

type DayInvoice = { receipt_no: string | null; payment_mode: string | null; amount_paid: number | string; issued_at: string; students: { full_name: string } | null };
type DayExpense = { id: string; mode: string; category: string | null; description: string; amount: number | string; created_by: string | null };
type DayDeposit = { id: string; amount: number | string; bank_name: string | null; deposit_receipt_no: string | null; reference: string | null; created_by: string | null };

export default async function CashbookPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const profile = await requireDepartment("fees");
  const schoolId = await getCurrentSchoolId(profile);
  const isAdmin = profile.role === "admin";
  const supabase = await createClient();

  const sp = await searchParams;
  const today = todayStr();
  const day = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const next = addDays(day, 1);
  const prev = addDays(day, -1);

  const settings = await getCashbookSettings(schoolId);
  const floor = settings.opening_date ?? "1970-01-01";

  // --- Running cash-in-hand: opening = anchor + (cash in − cash out) before the day ---
  const cashInBefore = await sumPages(async (from, to) => {
    const { data, error } = await supabase
      .from("invoices").select("amount_paid")
      .eq("school_id", schoolId).eq("payment_mode", "cash").neq("payment_status", "void")
      .gte("issued_at", dayStartISO(floor)).lt("issued_at", dayStartISO(day))
      .range(from, to);
    if (error) throw error;
    return ((data ?? []) as { amount_paid: number | string }[]).map((r) => Number(r.amount_paid) || 0);
  });
  // Cashbook tables may not exist before the migration is applied — tolerate.
  const cashExpBefore = await sumPages(async (from, to) => {
    const { data, error } = await supabase
      .from("cashbook_expenses").select("amount")
      .eq("school_id", schoolId).eq("mode", "cash")
      .gte("spent_on", floor).lt("spent_on", day)
      .range(from, to);
    if (error) return [];
    return ((data ?? []) as { amount: number | string }[]).map((r) => Number(r.amount) || 0);
  });
  const depositsBefore = await sumPages(async (from, to) => {
    const { data, error } = await supabase
      .from("bank_deposits").select("amount")
      .eq("school_id", schoolId)
      .gte("deposited_on", floor).lt("deposited_on", day)
      .range(from, to);
    if (error) return [];
    return ((data ?? []) as { amount: number | string }[]).map((r) => Number(r.amount) || 0);
  });
  const openingCash = Number(settings.opening_balance) + cashInBefore - cashExpBefore - depositsBefore;

  // --- The selected day ---
  const [collRes, expRes, depRes] = await Promise.all([
    supabase
      .from("invoices")
      .select("receipt_no, payment_mode, amount_paid, issued_at, students(full_name)")
      .eq("school_id", schoolId).neq("payment_status", "void")
      .gte("issued_at", dayStartISO(day)).lt("issued_at", dayStartISO(next))
      .order("issued_at", { ascending: false }),
    supabase
      .from("cashbook_expenses")
      .select("id, mode, category, description, amount, created_by")
      .eq("school_id", schoolId).eq("spent_on", day)
      .order("created_at", { ascending: false }),
    supabase
      .from("bank_deposits")
      .select("id, amount, bank_name, deposit_receipt_no, reference, created_by")
      .eq("school_id", schoolId).eq("deposited_on", day)
      .order("created_at", { ascending: false }),
  ]);
  if (collRes.error) throw collRes.error; // invoices always exist — surface outages

  const collections = (collRes.data ?? []) as unknown as DayInvoice[];
  const expenses = (expRes.data ?? []) as unknown as DayExpense[];
  const deposits = (depRes.data ?? []) as unknown as DayDeposit[];

  // Collections grouped by mode.
  const collByMode = new Map<string, { count: number; amount: number }>();
  for (const c of collections) {
    const m = c.payment_mode ?? "cash";
    const cur = collByMode.get(m) ?? { count: 0, amount: 0 };
    cur.count += 1;
    cur.amount += Number(c.amount_paid) || 0;
    collByMode.set(m, cur);
  }
  const totalCollections = collections.reduce((s, c) => s + (Number(c.amount_paid) || 0), 0);
  const cashCollections = collByMode.get("cash")?.amount ?? 0;

  // Expenses grouped by mode.
  const expByMode = new Map<string, number>();
  for (const e of expenses) expByMode.set(e.mode, (expByMode.get(e.mode) ?? 0) + (Number(e.amount) || 0));
  const totalExpenses = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const cashExpenses = expByMode.get("cash") ?? 0;
  const depositsDay = deposits.reduce((s, d) => s + (Number(d.amount) || 0), 0);

  const closingCash = openingCash + cashCollections - cashExpenses - depositsDay;

  return (
    <div className="max-w-6xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cashbook</h1>
          <p className="text-stone-500 text-sm">{prettyDate(day)}</p>
        </div>
        <div className="flex items-center gap-2">
          <NavLink href={`/fees/cashbook?date=${prev}`} label="← Prev" />
          <form method="GET" className="flex items-center gap-2">
            <input type="date" name="date" defaultValue={day} max={today}
              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm" />
            <button className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm">Go</button>
          </form>
          {day < today && <NavLink href={`/fees/cashbook?date=${next}`} label="Next →" />}
          {day !== today && <NavLink href={`/fees/cashbook`} label="Today" />}
        </div>
      </header>

      {!settings.opening_date && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No opening balance set yet — the running cash-in-hand starts from ₹0.
          {isAdmin ? " Set it below." : " Ask an admin to set the opening balance."}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat title="Opening cash" value={inr(openingCash)} tone="slate" />
        <Stat title="Collections" value={inr(totalCollections)} tone="emerald" hint={`Cash ${inr(cashCollections)}`} />
        <Stat title="Expenses + deposits" value={inr(totalExpenses + depositsDay)} tone="rose" hint={`Cash exp ${inr(cashExpenses)} · Dep ${inr(depositsDay)}`} />
        <Stat title="Closing cash" value={inr(closingCash)} tone="sky" hint="Rolls to tomorrow's opening" />
      </div>

      {/* Cash-in-hand reconciliation */}
      <section className="mt-6 card p-5">
        <h2 className="mb-2 text-sm font-semibold text-stone-800">Cash-in-hand</h2>
        <div className="text-sm text-stone-700">
          Opening {inr(openingCash)} + Cash collected {inr(cashCollections)} − Cash expenses {inr(cashExpenses)} − Deposited {inr(depositsDay)} =
          <span className="ml-1 font-semibold">{inr(closingCash)}</span>
        </div>
        <p className="mt-1 text-xs text-stone-500">Only cash affects cash-in-hand; UPI / cheque / internet-banking collections go to the bank.</p>
      </section>

      {/* Collections by mode */}
      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-stone-800">Collections by mode</h2>
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-stone-500">
              <tr><th className="px-4 py-2 font-medium">Mode</th><th className="px-4 py-2 font-medium text-right"># Receipts</th><th className="px-4 py-2 font-medium text-right">Amount</th></tr>
            </thead>
            <tbody>
              {collByMode.size === 0 && <tr><td colSpan={3} className="px-4 py-5 text-center text-stone-500">No collections on this day.</td></tr>}
              {[...collByMode.entries()].map(([mode, v]) => (
                <tr key={mode} className="border-t border-stone-100">
                  <td className="px-4 py-2">{MODE_LABEL[mode] ?? mode}</td>
                  <td className="px-4 py-2 text-right">{v.count}</td>
                  <td className="px-4 py-2 text-right font-medium">{inr(v.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Students paid today */}
      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-stone-800">Receipts today ({collections.length})</h2>
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-stone-500">
              <tr><th className="px-4 py-2 font-medium">Receipt #</th><th className="px-4 py-2 font-medium">Student</th><th className="px-4 py-2 font-medium">Mode</th><th className="px-4 py-2 font-medium text-right">Amount</th></tr>
            </thead>
            <tbody>
              {collections.length === 0 && <tr><td colSpan={4} className="px-4 py-5 text-center text-stone-500">No receipts.</td></tr>}
              {collections.map((c, i) => (
                <tr key={c.receipt_no ?? i} className="border-t border-stone-100">
                  <td className="px-4 py-2 font-mono text-xs">{c.receipt_no}</td>
                  <td className="px-4 py-2">{c.students?.full_name ?? "—"}</td>
                  <td className="px-4 py-2">{MODE_LABEL[c.payment_mode ?? ""] ?? c.payment_mode}</td>
                  <td className="px-4 py-2 text-right font-medium">{inr(c.amount_paid)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Expenses + Deposits side by side */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm font-semibold text-stone-800">Expenses today ({inr(totalExpenses)})</h2>
          <div className="card mb-3 p-5"><ExpenseForm day={day} /></div>
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-left text-stone-500"><tr><th className="px-4 py-2 font-medium">Description</th><th className="px-4 py-2 font-medium">Mode</th><th className="px-4 py-2 font-medium text-right">Amount</th></tr></thead>
              <tbody>
                {expenses.length === 0 && <tr><td colSpan={3} className="px-4 py-5 text-center text-stone-500">No expenses.</td></tr>}
                {expenses.map((e) => (
                  <tr key={e.id} className="border-t border-stone-100">
                    <td className="px-4 py-2">{e.description}{e.category ? <span className="text-stone-400"> · {e.category}</span> : null}</td>
                    <td className="px-4 py-2">{MODE_LABEL[e.mode] ?? e.mode}</td>
                    <td className="px-4 py-2 text-right font-medium">{inr(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-stone-800">Bank deposits today ({inr(depositsDay)})</h2>
          <div className="card mb-3 p-5"><DepositForm day={day} /></div>
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-left text-stone-500"><tr><th className="px-4 py-2 font-medium">Bank</th><th className="px-4 py-2 font-medium">Receipt #</th><th className="px-4 py-2 font-medium text-right">Amount</th></tr></thead>
              <tbody>
                {deposits.length === 0 && <tr><td colSpan={3} className="px-4 py-5 text-center text-stone-500">No deposits.</td></tr>}
                {deposits.map((d) => (
                  <tr key={d.id} className="border-t border-stone-100">
                    <td className="px-4 py-2">{d.bank_name ?? "—"}</td>
                    <td className="px-4 py-2 font-mono text-xs">{d.deposit_receipt_no ?? d.reference ?? "—"}</td>
                    <td className="px-4 py-2 text-right font-medium">{inr(d.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {isAdmin && (
        <section className="mt-8 card p-5">
          <h2 className="mb-3 text-sm font-semibold text-stone-800">Opening balance (admin)</h2>
          <OpeningBalanceForm currentBalance={Number(settings.opening_balance)} currentDate={settings.opening_date} />
        </section>
      )}
    </div>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50">
      {label}
    </Link>
  );
}

function Stat({ title, value, tone, hint }: { title: string; value: string; tone: "emerald" | "amber" | "rose" | "sky" | "slate"; hint?: string }) {
  const accent = { emerald: "text-emerald-700", amber: "text-amber-700", rose: "text-rose-700", sky: "text-sky-700", slate: "text-stone-700" }[tone];
  return (
    <div className="card p-5">
      <div className="text-xs uppercase tracking-wide text-stone-500">{title}</div>
      <div className={`mt-2 text-2xl font-semibold ${accent}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-stone-400">{hint}</div>}
    </div>
  );
}
