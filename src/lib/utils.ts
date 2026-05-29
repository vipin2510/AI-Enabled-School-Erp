import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function inr(amount: number | string | null | undefined) {
  if (amount === null || amount === undefined || amount === "") return "₹0";
  const n = typeof amount === "string" ? Number(amount) : amount;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

// The school operates in India; render every date/time in IST regardless of
// where the server runs (Vercel functions run in UTC).
export const TIME_ZONE = "Asia/Kolkata";

export function formatDate(d: string | Date | null | undefined) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Date + time in IST, e.g. "27 May 2026, 02:15 pm".
export function formatDateTime(d: string | Date | null | undefined) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Time-of-day in IST, e.g. "02:15 pm".
export function formatTime(d: string | Date | null | undefined) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-IN", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function daysBetween(a: Date, b: Date) {
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

// Monthly fee components use period_index = calendar month (1..12). The school
// session runs Apr → Mar, so present months in that order for pickers.
export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const ACADEMIC_MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];

export function monthName(index: number) {
  return MONTH_NAMES[index - 1] ?? "";
}

// "May 2026" rendered in IST regardless of where the code runs.
export function monthYearLabel(d: Date = new Date()) {
  return d.toLocaleDateString("en-IN", {
    timeZone: TIME_ZONE,
    month: "long",
    year: "numeric",
  });
}
