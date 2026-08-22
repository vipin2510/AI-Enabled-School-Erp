import Link from "next/link";
import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { inr } from "@/lib/utils";
import { todayStr, addDays, prettyDate } from "@/lib/attendance";
import { getCashbookSettings } from "@/lib/cache";
import { getCashbookDay, MODE_LABEL } from "@/lib/cashbook";
import { DownloadButton } from "@/components/ui/download-button";
import { PreviewButton } from "@/components/ui/preview-button";
import { DepositForm, OpeningBalanceForm } from "./cashbook-forms";

export const dynamic = "force-dynamic";

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

  const [data, settings] = await Promise.all([
    getCashbookDay(supabase, schoolId, day),
    getCashbookSettings(schoolId),
  ]);

  const btn =
    "rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50";

  return (
    <div className="max-w-6xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cashbook</h1>
          <p className="text-stone-500 text-sm">{prettyDate(day)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PreviewButton url={`/api/fees/cashbook/pdf?date=${day}`} className={btn}>
            Preview / Print
          </PreviewButton>
          <DownloadButton url={`/api/fees/cashbook/pdf?date=${day}`} filename={`cashbook-${day}.pdf`} className={btn}>
            ⤓ PDF
          </DownloadButton>
          <NavLink href={`/fees/cashbook?date=${prev}`} label="← Prev" />
          <form method="GET" className="flex items-center gap-2">
            <input type="date" name="date" defaultValue={day} max={today}
              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm" />
            <button className={btn}>Go</button>
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
        <Stat title="Opening cash" value={inr(data.opening)} tone="slate" />
        <Stat title="Collections" value={inr(data.collections.total)} tone="emerald" hint={`Cash ${inr(data.collections.cash)}`} />
        <Stat title="Expenses + deposits" value={inr(data.expenses.total + data.deposits.total)} tone="rose" hint={`Cash exp ${inr(data.expenses.cashTotal)} · Dep ${inr(data.deposits.total)}`} />
        <Stat title="Closing cash" value={inr(data.closing)} tone="sky" hint="Rolls to tomorrow's opening" />
      </div>

      {/* Cash-in-hand reconciliation */}
      <section className="mt-6 card p-5">
        <h2 className="mb-2 text-sm font-semibold text-stone-800">Cash-in-hand</h2>
        <div className="text-sm text-stone-700">
          Opening {inr(data.opening)} + Cash collected {inr(data.collections.cash)} − Cash expenses {inr(data.expenses.cashTotal)} − Deposited {inr(data.deposits.total)} =
          <span className="ml-1 font-semibold">{inr(data.closing)}</span>
        </div>
        <p className="mt-1 text-xs text-stone-500">
          Only cash affects cash-in-hand; UPI / cheque / internet-banking collections go to the bank.
          Expenses are recorded &amp; approved on the{" "}
          <Link href="/fees/expenses" className="text-accent hover:underline">Expenses</Link> page.
        </p>
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
              {data.collections.byMode.length === 0 && <tr><td colSpan={3} className="px-4 py-5 text-center text-stone-500">No collections on this day.</td></tr>}
              {data.collections.byMode.map((v) => (
                <tr key={v.mode} className="border-t border-stone-100">
                  <td className="px-4 py-2">{MODE_LABEL[v.mode] ?? v.mode}</td>
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
        <h2 className="mb-2 text-sm font-semibold text-stone-800">Receipts today ({data.collections.list.length})</h2>
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-stone-500">
              <tr><th className="px-4 py-2 font-medium">Receipt #</th><th className="px-4 py-2 font-medium">Student</th><th className="px-4 py-2 font-medium">Mode</th><th className="px-4 py-2 font-medium text-right">Amount</th></tr>
            </thead>
            <tbody>
              {data.collections.list.length === 0 && <tr><td colSpan={4} className="px-4 py-5 text-center text-stone-500">No receipts.</td></tr>}
              {data.collections.list.map((c, i) => (
                <tr key={c.receipt_no ?? i} className="border-t border-stone-100">
                  <td className="px-4 py-2 font-mono text-xs">{c.receipt_no}</td>
                  <td className="px-4 py-2">{c.student_name ?? "—"}</td>
                  <td className="px-4 py-2">{MODE_LABEL[c.payment_mode ?? ""] ?? c.payment_mode}</td>
                  <td className="px-4 py-2 text-right font-medium">{inr(c.amount_paid)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Bank deposits — left column. Expenses live on the dedicated Expenses page. */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm font-semibold text-stone-800">Bank deposits today ({inr(data.deposits.total)})</h2>
          <div className="card mb-3 p-5"><DepositForm day={day} /></div>
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-left text-stone-500"><tr><th className="px-4 py-2 font-medium">Bank</th><th className="px-4 py-2 font-medium">Receipt #</th><th className="px-4 py-2 font-medium text-right">Amount</th></tr></thead>
              <tbody>
                {data.deposits.list.length === 0 && <tr><td colSpan={3} className="px-4 py-5 text-center text-stone-500">No deposits.</td></tr>}
                {data.deposits.list.map((d, i) => (
                  <tr key={i} className="border-t border-stone-100">
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
