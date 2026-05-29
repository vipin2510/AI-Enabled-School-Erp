// Attendance date helpers. Dates are plain "YYYY-MM-DD" strings interpreted in
// IST (the school's timezone) so "Sunday" and "today" match what the user sees,
// regardless of where the server runs (Vercel functions run in UTC).

import { TIME_ZONE } from "@/lib/utils";

// Anchor at noon so neither the weekday nor the formatted date can shift across
// a timezone boundary.
export function parseLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12);
}

export function isSunday(dateStr: string): boolean {
  return parseLocal(dateStr).getDay() === 0;
}

// The calendar date in IST for the given instant (default: now). en-CA formats
// as "YYYY-MM-DD".
export function todayStr(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

// Shift a "YYYY-MM-DD" date by whole days, returning the same string format.
export function addDays(dateStr: string, days: number): string {
  const d = parseLocal(dateStr);
  d.setDate(d.getDate() + days);
  return todayStr(d);
}

export function prettyDate(dateStr: string): string {
  return parseLocal(dateStr).toLocaleDateString("en-IN", {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
