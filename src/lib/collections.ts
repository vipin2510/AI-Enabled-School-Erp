// Fee-collection summary over a date range, grouped by payment mode and by day.
// Shared by the Collections report page and its CSV export so both show the
// exact same numbers. Collections are read from `invoices` (payment_mode +
// amount_paid + issued_at, excluding void) — the same source the Cashbook uses.

import { addDays } from "@/lib/attendance";
import type { createClient } from "@/lib/supabase/server";
import { TIME_ZONE } from "@/lib/utils";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export const MODE_LABEL: Record<string, string> = {
  cash: "Cash",
  upi: "UPI",
  cheque: "Cheque",
  card: "Card",
  bank: "Bank Transfer",
  inb: "Internet Banking",
};

// Order modes deterministically: known modes first (in this order), then any
// others alphabetically — so table columns don't jump around between ranges.
const MODE_ORDER = ["cash", "upi", "cheque", "card", "bank", "inb"];
export function sortModes(modes: Iterable<string>): string[] {
  return [...new Set(modes)].sort((a, b) => {
    const ia = MODE_ORDER.indexOf(a);
    const ib = MODE_ORDER.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return a.localeCompare(b);
  });
}

// A timestamptz filtered by an IST calendar day boundary as an absolute instant,
// so ranges match the calendar dates the user picked regardless of server TZ.
const dayStartISO = (d: string) => `${d}T00:00:00+05:30`;

// The IST calendar date ("YYYY-MM-DD") for a given instant.
function istDate(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export type DayRow = {
  date: string;
  modeAmounts: Record<string, number>;
  total: number;
  count: number;
};

export type CollectionsSummary = {
  from: string;
  to: string;
  modes: string[];
  byMode: Record<string, { count: number; amount: number }>;
  byDay: DayRow[];
  total: number;
  count: number;
};

// `from`/`to` are inclusive "YYYY-MM-DD" IST dates. Returns per-mode and per-day
// aggregates plus grand totals.
export async function getCollectionsSummary(
  supabase: ServerClient,
  schoolId: string,
  from: string,
  to: string,
): Promise<CollectionsSummary> {
  // Tolerate a reversed range by swapping.
  if (from > to) [from, to] = [to, from];
  const toNext = addDays(to, 1);

  const rows: { payment_mode: string | null; amount_paid: number | string; issued_at: string }[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await supabase
      .from("invoices")
      .select("payment_mode, amount_paid, issued_at")
      .eq("school_id", schoolId)
      .neq("payment_status", "void")
      .gte("issued_at", dayStartISO(from))
      .lt("issued_at", dayStartISO(toNext))
      .order("issued_at", { ascending: true })
      .range(start, start + 999);
    if (error) throw error;
    const page = (data ?? []) as typeof rows;
    rows.push(...page);
    if (page.length < 1000) break;
  }

  const byMode: Record<string, { count: number; amount: number }> = {};
  const dayMap = new Map<string, DayRow>();
  let total = 0;

  for (const r of rows) {
    const mode = r.payment_mode ?? "cash";
    const amt = Number(r.amount_paid) || 0;
    total += amt;

    const bm = (byMode[mode] ??= { count: 0, amount: 0 });
    bm.count += 1;
    bm.amount += amt;

    const date = istDate(r.issued_at);
    const day = dayMap.get(date) ?? { date, modeAmounts: {}, total: 0, count: 0 };
    day.modeAmounts[mode] = (day.modeAmounts[mode] ?? 0) + amt;
    day.total += amt;
    day.count += 1;
    dayMap.set(date, day);
  }

  const byDay = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  const modes = sortModes(Object.keys(byMode));

  return { from, to, modes, byMode, byDay, total, count: rows.length };
}
