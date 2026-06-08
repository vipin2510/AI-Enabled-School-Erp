// The current academic year as "YYYY-YY". The school session opens in April,
// so any month from April onward belongs to year → year+1. Used everywhere
// fees/results/timetable need to scope to "this year" — keep this as the only
// place that decides what "this year" means.
export function currentAcademicYear(now: Date = new Date()): string {
  const y = now.getFullYear();
  const startYear = now.getMonth() + 1 >= 4 ? y : y - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}
