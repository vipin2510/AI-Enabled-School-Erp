import Link from "next/link";
import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { inr } from "@/lib/utils";
import { todayStr, addDays, prettyDate } from "@/lib/attendance";
import { getCollectionsSummary, MODE_LABEL } from "@/lib/collections";

export const dynamic = "force-dynamic";

const isDate = (s: string | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
const monthStart = (d: string) => `${d.slice(0, 7)}-01`;

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const profile = await requireDepartment("fees");
  const schoolId = await getCurrentSchoolId(profile);
  const supabase = await createClient();

  const today = todayStr();
  const sp = await searchParams;
  let from = isDate(sp.from) ? sp.from : monthStart(today);
  let to = isDate(sp.to) ? sp.to : today;
  if (from > to) [from, to] = [to, from];

  const { modes, byMode, byDay, total, count } = await getCollectionsSummary(
    supabase,
    schoolId,
    from,
    to,
  );

  // Quick-range presets. Last month = the calendar month before `today`.
  const lastMonthEnd = addDays(monthStart(today), -1);
  const presets: { label: string; from: string; to: string }[] = [
    { label: "This month", from: monthStart(today), to: today },
    { label: "Last month", from: monthStart(lastMonthEnd), to: lastMonthEnd },
    { label: "Last 7 days", from: addDays(today, -6), to: today },
    { label: "Today", from: today, to: today },
  ];
  const exportHref = `/api/fees/collections-export?from=${from}&to=${to}`;

  return (
    <div className="max-w-6xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Collections</h1>
          <p className="text-stone-500 text-sm">
            {prettyDate(from)} — {prettyDate(to)} · fee collections by payment mode
          </p>
        </div>
        <a
          href={exportHref}
          className="rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
        >
          ⤓ Export CSV
        </a>
      </header>

      {/* Range picker + presets */}
      <div className="card mb-6 flex flex-wrap items-end gap-3 p-4">
        <form method="GET" className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-stone-500">From</span>
            <input type="date" name="from" defaultValue={from} max={today}
              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-stone-500">To</span>
            <input type="date" name="to" defaultValue={to} max={today}
              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm" />
          </label>
          <button className="rounded-lg bg-stone-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-stone-800">
            Go
          </button>
        </form>
        <div className="flex flex-wrap items-center gap-2">
          {presets.map((p) => {
            const active = p.from === from && p.to === to;
            return (
              <Link
                key={p.label}
                href={`/fees/collections?from=${p.from}&to=${p.to}`}
                className={
                  "rounded-full px-3 py-1 text-xs font-medium " +
                  (active
                    ? "bg-stone-900 text-white"
                    : "border border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100")
                }
              >
                {p.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Totals: one card per mode + grand total */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {modes.map((m) => (
          <div key={m} className="card p-5">
            <div className="text-xs uppercase tracking-wide text-stone-500">{MODE_LABEL[m] ?? m}</div>
            <div className="mt-2 text-2xl font-semibold text-emerald-700">{inr(byMode[m].amount)}</div>
            <div className="mt-1 text-xs text-stone-400">{byMode[m].count} receipt(s)</div>
          </div>
        ))}
        <div className="card border-stone-300 bg-stone-50 p-5">
          <div className="text-xs uppercase tracking-wide text-stone-500">Total collected</div>
          <div className="mt-2 text-2xl font-semibold text-stone-900">{inr(total)}</div>
          <div className="mt-1 text-xs text-stone-400">{count} receipt(s)</div>
        </div>
      </div>

      {/* Day-by-day breakdown */}
      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-stone-800">Day-by-day</h2>
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="bg-stone-50 text-left text-stone-500">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                {modes.map((m) => (
                  <th key={m} className="px-4 py-2 text-right font-medium">{MODE_LABEL[m] ?? m}</th>
                ))}
                <th className="px-4 py-2 text-right font-medium">Total</th>
                <th className="px-4 py-2 text-right font-medium"># Rcpt</th>
              </tr>
            </thead>
            <tbody>
              {byDay.length === 0 && (
                <tr>
                  <td colSpan={modes.length + 3} className="px-4 py-6 text-center text-stone-500">
                    No collections in this range.
                  </td>
                </tr>
              )}
              {byDay.map((d) => (
                <tr key={d.date} className="border-t border-stone-100">
                  <td className="px-4 py-2 whitespace-nowrap">{prettyDate(d.date)}</td>
                  {modes.map((m) => (
                    <td key={m} className="px-4 py-2 text-right tabular-nums">
                      {d.modeAmounts[m] ? inr(d.modeAmounts[m]) : <span className="text-stone-300">—</span>}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-right font-medium tabular-nums">{inr(d.total)}</td>
                  <td className="px-4 py-2 text-right text-stone-500 tabular-nums">{d.count}</td>
                </tr>
              ))}
            </tbody>
            {byDay.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-stone-200 bg-stone-50 font-semibold">
                  <td className="px-4 py-2">Total</td>
                  {modes.map((m) => (
                    <td key={m} className="px-4 py-2 text-right tabular-nums">{inr(byMode[m].amount)}</td>
                  ))}
                  <td className="px-4 py-2 text-right tabular-nums">{inr(total)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{count}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <p className="mt-2 text-xs text-stone-400">
          Excludes voided receipts. Only cash affects cash-in-hand; UPI / cheque / bank collections
          go to the bank. Reconcile a mode&apos;s total against its statement to tally.
        </p>
      </section>
    </div>
  );
}
