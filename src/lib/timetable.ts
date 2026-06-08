// In-memory timetable generator. No DB, no I/O — pure function. Given a class's
// inputs (subjects with weekly frequencies, period count, lunch position, etc.)
// it produces three different valid timetables so the user can pick one.

export type SubjectKind = "scholastic" | "co_curricular";

export type SubjectInput = {
  name: string;
  teacher: string;          // free-text; appears next to the subject in the grid
  periodsPerWeek: number;   // total weekly periods this subject needs
  kind: SubjectKind;        // scholastic prefers morning; co-curricular afternoon
};

export type TimetableInput = {
  className: string;
  daysPerWeek: 5 | 6;       // Mon–Fri or Mon–Sat
  periodsPerDay: number;    // total teaching periods (excluding lunch)
  periodMinutes: number;    // length of one period
  startTime: string;        // "HH:MM" — first bell
  lunchAfterPeriod: number; // lunch break sits after this period number (1-based). 0 = no lunch.
  lunchMinutes: number;
  totalTeachers: number;    // sanity check only; not used to place subjects
  subjects: SubjectInput[];
};

export type Cell = {
  subject: string;
  teacher: string;
  kind: SubjectKind;
} | { free: true };

export type Slot = {
  index: number;            // 1-based period number
  startTime: string;
  endTime: string;
};

export type Timetable = {
  label: string;            // "Variant A" etc.
  slots: Slot[];            // periods + a lunch entry as a special "break"
  lunchSlot: Slot | null;
  days: string[];           // ["Mon", "Tue", ...]
  grid: Cell[][];           // [dayIndex][periodIndex] — periodIndex matches slots[]
};

export type GenerateResult = {
  variants: Timetable[];
  warnings: string[];       // soft issues (e.g. subjects exceed capacity, frequencies trimmed)
};

const DAY_NAMES_6 = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES_5 = ["Mon", "Tue", "Wed", "Thu", "Fri"];

// Deterministic 32-bit PRNG so each variant is stable for a given seed. Reusing
// Math.random would make "Variant A" change on every render — that's annoying
// for the user comparing options.
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace<T>(arr: T[], rand: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function addMinutes(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(":").map((n) => Number(n));
  const total = h * 60 + m + mins;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

// Build the time column once — same for every variant.
function buildSlots(input: TimetableInput): { slots: Slot[]; lunchSlot: Slot | null } {
  const slots: Slot[] = [];
  let cursor = input.startTime;
  let lunchSlot: Slot | null = null;
  for (let i = 1; i <= input.periodsPerDay; i++) {
    const start = cursor;
    const end = addMinutes(cursor, input.periodMinutes);
    slots.push({ index: i, startTime: start, endTime: end });
    cursor = end;
    if (input.lunchAfterPeriod > 0 && i === input.lunchAfterPeriod && input.lunchMinutes > 0) {
      lunchSlot = { index: -1, startTime: cursor, endTime: addMinutes(cursor, input.lunchMinutes) };
      cursor = lunchSlot.endTime;
    }
  }
  return { slots, lunchSlot };
}

// Expand subjects into an array of "tickets" — one ticket per period that
// subject claims in the week. e.g. Math (6/week) → six Math tickets.
function buildTickets(subjects: SubjectInput[]): SubjectInput[] {
  const tickets: SubjectInput[] = [];
  for (const s of subjects) {
    for (let i = 0; i < s.periodsPerWeek; i++) {
      tickets.push({ ...s });
    }
  }
  return tickets;
}

// Place tickets into a day×period grid. Heuristics applied softly:
//   • Avoid placing the same subject twice in one day if other days have room.
//   • Scholastic prefers periods before lunch; co-curricular prefers after.
// If a hard constraint can't be met (e.g. only one day left for two of the
// same), we accept the violation instead of leaving a hole.
function placeTickets(
  tickets: SubjectInput[],
  daysCount: number,
  periodsPerDay: number,
  lunchAfter: number,
  rand: () => number
): Cell[][] {
  const grid: Cell[][] = Array.from({ length: daysCount }, () =>
    Array.from({ length: periodsPerDay }, () => ({ free: true } as Cell))
  );

  // Sort tickets so heavier-load subjects place first (gives them best slots).
  // Within the same subject, kind-preference splits morning vs afternoon.
  const byKindThenRandom = [...tickets];
  shuffleInPlace(byKindThenRandom, rand);
  // Stable secondary sort: scholastic first.
  byKindThenRandom.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "scholastic" ? -1 : 1;
    return 0;
  });

  // Track per-day usage of each subject so we can prefer spreading.
  const usedToday: Record<string, number>[] = grid.map(() => ({}));

  // Period preference helper: scholastic likes 0..lunchAfter-1, co_curricular likes lunchAfter..end.
  const preferredPeriods = (kind: SubjectKind): number[] => {
    const all = Array.from({ length: periodsPerDay }, (_, i) => i);
    if (lunchAfter <= 0) return all;
    const morning = all.filter((i) => i < lunchAfter);
    const afternoon = all.filter((i) => i >= lunchAfter);
    return kind === "scholastic" ? [...morning, ...afternoon] : [...afternoon, ...morning];
  };

  for (const t of byKindThenRandom) {
    // Day order: ascending by current count of this subject (spread it out),
    // tiebreak by total occupancy (don't pile on the same day).
    const dayOrder = Array.from({ length: daysCount }, (_, d) => d).sort((a, b) => {
      const ua = usedToday[a][t.name] ?? 0;
      const ub = usedToday[b][t.name] ?? 0;
      if (ua !== ub) return ua - ub;
      const oa = grid[a].filter((c) => !("free" in c)).length;
      const ob = grid[b].filter((c) => !("free" in c)).length;
      return oa - ob;
    });

    let placed = false;
    const periodOrder = preferredPeriods(t.kind);

    // First pass: respect "not twice in one day" hard rule.
    for (const d of dayOrder) {
      if ((usedToday[d][t.name] ?? 0) > 0) continue;
      for (const p of periodOrder) {
        if ("free" in grid[d][p]) {
          grid[d][p] = { subject: t.name, teacher: t.teacher, kind: t.kind };
          usedToday[d][t.name] = 1;
          placed = true;
          break;
        }
      }
      if (placed) break;
    }
    // Fallback: allow same subject twice in a day.
    if (!placed) {
      for (const d of dayOrder) {
        for (const p of periodOrder) {
          if ("free" in grid[d][p]) {
            grid[d][p] = { subject: t.name, teacher: t.teacher, kind: t.kind };
            usedToday[d][t.name] = (usedToday[d][t.name] ?? 0) + 1;
            placed = true;
            break;
          }
        }
        if (placed) break;
      }
    }
    // Grid was full — caller saw this as a capacity warning already.
  }

  return grid;
}

export function generateTimetables(input: TimetableInput): GenerateResult {
  const warnings: string[] = [];
  const daysCount = input.daysPerWeek;
  const dayNames = daysCount === 6 ? DAY_NAMES_6 : DAY_NAMES_5;

  const totalSlots = daysCount * input.periodsPerDay;
  const ticketDemand = input.subjects.reduce((s, x) => s + x.periodsPerWeek, 0);

  if (ticketDemand > totalSlots) {
    warnings.push(
      `Subjects need ${ticketDemand} periods/week but the schedule only has ${totalSlots}. Some periods will be dropped.`
    );
  } else if (ticketDemand < totalSlots) {
    warnings.push(
      `Subjects fill ${ticketDemand} of ${totalSlots} weekly periods. The rest will show as "Free".`
    );
  }

  if (input.totalTeachers > 0) {
    const distinctTeachers = new Set(input.subjects.map((s) => s.teacher.trim()).filter(Boolean)).size;
    if (distinctTeachers > input.totalTeachers) {
      warnings.push(
        `You named ${distinctTeachers} distinct teachers but said total teachers is ${input.totalTeachers}.`
      );
    }
  }

  const { slots, lunchSlot } = buildSlots(input);
  const tickets = buildTickets(input.subjects).slice(0, totalSlots);

  // Three variants from three different seeds. Same inputs → same outputs each
  // render — so refreshing doesn't reshuffle while the user is comparing.
  const seeds = [0xa1b2c3, 0xdeadbe, 0x1f2e3d];
  const labels = ["Variant A", "Variant B", "Variant C"];

  const variants: Timetable[] = seeds.map((seed, i) => {
    const rand = mulberry32(seed);
    const grid = placeTickets(tickets, daysCount, input.periodsPerDay, input.lunchAfterPeriod, rand);
    return {
      label: labels[i],
      slots,
      lunchSlot,
      days: dayNames,
      grid,
    };
  });

  return { variants, warnings };
}
