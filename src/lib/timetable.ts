// Shared timetable model for the persisted, editable timetable.
//
// Structure (fixed for Adeshwar):
//   • Days: Mon(1) … Sat(6).
//   • Periods: Mon–Fri = 8, Sat = 5  → 45 periods/week.
//   • Period 1 of every day is the CLASS TEACHER's period (derived from the
//     class-teacher assignment, not stored per-slot).

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

// A stored slot (periods 2..N). Period 1 is never stored — it's the class teacher.
export type TimetableSlot = {
  day: number; // 1..6
  period: number; // 2..8
  subject_name: string | null;
  teacher_id: string | null;
};

export const CLASS_TEACHER_PERIOD = 1;
