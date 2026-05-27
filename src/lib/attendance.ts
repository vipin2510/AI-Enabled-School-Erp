// Attendance date helpers. Dates are plain "YYYY-MM-DD" strings parsed in the
// local timezone so "Sunday" and "today" match what the user sees.

export function parseLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function isSunday(dateStr: string): boolean {
  return parseLocal(dateStr).getDay() === 0;
}

export function todayStr(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function prettyDate(dateStr: string): string {
  return parseLocal(dateStr).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
