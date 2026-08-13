// Shared timetable model for the persisted, editable timetable.
//
// Structure (fixed for Adeshwar):
//   • Days: Mon(1) … Sat(6).
//   • Periods: Mon–Fri = 8, Sat = 5  → 45 periods/week.
//   • Every period (1..N) is a normal editable subject+teacher slot.
//   • Each class/section also has an optional separate "remedial" timetable
//     (kind = 'remedial') with its own validity window.

export const DAYS: { n: number; name: string; full: string }[] = [
  { n: 1, name: "Mon", full: "Monday" },
  { n: 2, name: "Tue", full: "Tuesday" },
  { n: 3, name: "Wed", full: "Wednesday" },
  { n: 4, name: "Thu", full: "Thursday" },
  { n: 5, name: "Fri", full: "Friday" },
  { n: 6, name: "Sat", full: "Saturday" },
];

export const MAX_PERIOD = 8;
export const SAT_PERIODS = 5;

// How many periods a given day runs. Saturday is short.
export function periodsForDay(day: number): number {
  return day === 6 ? SAT_PERIODS : MAX_PERIOD;
}

// Total teaching periods in a week (45): Mon–Fri 8 each + Sat 5.
export const TOTAL_PERIODS = DAYS.reduce((sum, d) => sum + periodsForDay(d.n), 0);

// A stored slot (periods 1..N).
export type TimetableSlot = {
  day: number; // 1..6
  period: number; // 1..8
  subject_name: string | null;
  teacher_id: string | null;
};

// The two timetables each class/section can have.
export type TimetableKind = "regular" | "remedial";
