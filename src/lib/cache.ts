import { cached, tagFor } from "@/lib/cache/index";
import { createAnonClient } from "@/lib/supabase/anon";
import type { FeePrintLayout } from "@/lib/fee-print-layout";

// Re-export the tag builders so existing callers (`@/lib/cache`) keep working
// after the move from `unstable_cache` to the local store.
export { tagFor };

// Cached read layer for the hot, rarely-changing tenant data. Each helper:
//   • is keyed by school_id (and other args) so tenants don't share entries
//   • picks a TTL per how often the underlying data actually changes
//   • is tagged so a mutation can call `bustTag(tagFor.*())` to flush
//
// Queries inside these helpers run against a cookie-less anon client because
// they may be executed during cache fills outside request scope. The tenant
// filter is always an explicit `.eq("school_id", id)` — never relies on a
// session.

type ClassRow = { id: string; display_name: string; ordinal: number };

// Classes change at most a couple of times a year (a section split, a new
// grade). 10 minutes is a comfortable TTL — well within "looks instant" for
// a navigation, and well below "people get confused by stale data" after a
// leader just added one.
export function getClasses(schoolId: string): Promise<ClassRow[]> {
  return cached(
    `classes:${schoolId}`,
    [tagFor.classes(schoolId)],
    600,
    async () => {
      const supabase = createAnonClient();
      const { data, error } = await supabase
        .from("classes")
        .select("id, display_name, ordinal")
        .eq("school_id", schoolId)
        .order("ordinal");
      if (error) throw error;
      return (data ?? []) as ClassRow[];
    },
  );
}

// Fee structures + their components for a school + AY. Source of truth for
// the Collect Fee page and the Fees dashboard's per-class monthly amount.
// Edited rarely; aggressive TTL is safe because the editor busts the tag on
// save (see `app/fees/structures/actions.ts`).
type FeeStructureBundle = unknown;
export function getFeeStructures(
  schoolId: string,
  academicYear: string,
): Promise<FeeStructureBundle[]> {
  return cached(
    `fee_structures:${schoolId}:${academicYear}`,
    [tagFor.feeStructures(schoolId)],
    600,
    async () => {
      const supabase = createAnonClient();
      const { data, error } = await supabase
        .from("fee_structures")
        .select(
          "id, class_id, scope, group_label, student_kind, total_amount, fee_structure_components(id, kind, amount, period_index)",
        )
        .eq("school_id", schoolId)
        .eq("academic_year", academicYear);
      if (error) throw error;
      return (data ?? []) as FeeStructureBundle[];
    },
  );
}

// Late-fee settings — one row per school, almost never changes after
// onboarding. Cached for 30 minutes; the settings page calls bustTag from
// `app/settings/late-fee/actions.ts`.
export type LateFeeSettings = {
  per_day_amount: number;
  grace_days: number;
  is_enabled: boolean;
  monthly_due_day: number;
};
const LATE_FEE_DEFAULTS: LateFeeSettings = {
  per_day_amount: 100,
  grace_days: 0,
  is_enabled: true,
  monthly_due_day: 10,
};
export function getLateFeeSettings(schoolId: string): Promise<LateFeeSettings> {
  return cached(
    `late_fee_settings:${schoolId}`,
    [tagFor.lateFeeSettings(schoolId)],
    1800,
    async () => {
      const supabase = createAnonClient();
      const withDay = await supabase
        .from("late_fee_settings")
        .select("per_day_amount, grace_days, is_enabled, monthly_due_day")
        .eq("school_id", schoolId)
        .maybeSingle();
      if (!withDay.error && withDay.data) {
        return { ...LATE_FEE_DEFAULTS, ...(withDay.data as Partial<LateFeeSettings>) };
      }
      // Pre-migration deployments may not have `monthly_due_day` yet — fall
      // back to the basic shape so the page never crashes.
      const basic = await supabase
        .from("late_fee_settings")
        .select("per_day_amount, grace_days, is_enabled")
        .eq("school_id", schoolId)
        .maybeSingle();
      return basic.data
        ? { ...LATE_FEE_DEFAULTS, ...(basic.data as Partial<LateFeeSettings>) }
        : LATE_FEE_DEFAULTS;
    },
  );
}

// Fee-receipt print layout — one row per school, set once and rarely
// touched. Read on every receipt PDF render, so cache for 30 min; the
// settings page busts the tag from `app/settings/fees-print-layout/actions.ts`.
// All sizes are millimetres on A4 (210 × 297 mm). The `FeePrintLayout` shape
// lives in `@/lib/fee-print-layout` (shared with the client preview).
export type { FeePrintLayout };
// Defaults: a 2×2 portrait grid (half A4 width × half height). The two copies
// (School + Student) print in the top row; the bottom row is left blank. Each
// copy carries a 15 mm left punch gutter so either can be hole-punched.
export const FEE_PRINT_DEFAULTS: FeePrintLayout = {
  orientation: "portrait",
  box_width_mm: 99,
  box_height_mm: 142.5,
  page_margin_mm: 6,
  box_gap_mm: 0,
  school_binding_mm: 15,
};
export function getFeePrintLayout(schoolId: string): Promise<FeePrintLayout> {
  return cached(
    `fee_print_settings:${schoolId}`,
    [tagFor.feePrintSettings(schoolId)],
    1800,
    async () => {
      const supabase = createAnonClient();
      // Table may not exist yet on pre-migration deployments — swallow the
      // error and fall back to the historic stacked layout.
      const { data, error } = await supabase
        .from("fee_print_settings")
        .select("orientation, box_width_mm, box_height_mm, page_margin_mm, box_gap_mm, school_binding_mm")
        .eq("school_id", schoolId)
        .maybeSingle();
      if (error || !data) return FEE_PRINT_DEFAULTS;
      const d = data as Partial<FeePrintLayout>;
      return {
        orientation: d.orientation ?? FEE_PRINT_DEFAULTS.orientation,
        box_width_mm: Number(d.box_width_mm ?? FEE_PRINT_DEFAULTS.box_width_mm),
        box_height_mm: Number(d.box_height_mm ?? FEE_PRINT_DEFAULTS.box_height_mm),
        page_margin_mm: Number(d.page_margin_mm ?? FEE_PRINT_DEFAULTS.page_margin_mm),
        box_gap_mm: Number(d.box_gap_mm ?? FEE_PRINT_DEFAULTS.box_gap_mm),
        school_binding_mm: Number(d.school_binding_mm ?? FEE_PRINT_DEFAULTS.school_binding_mm),
      };
    },
  );
}

// "Has THIS user marked attendance today?" — hit on every request by the
// shell (topbar) for managers/staff. The value flips at most once per day,
// per user; cache for 60s so the topbar redraw doesn't re-hit the DB on
// every nav, and bust the tag from `app/actions/staff-attendance.ts` after
// a mark so the UI flips immediately.
export function getStaffAttendanceMarkedAt(
  schoolId: string,
  profileId: string,
  date: string,
): Promise<string | null> {
  return cached(
    `staff_attendance:${schoolId}:${profileId}:${date}`,
    [tagFor.staffAttendance(schoolId, profileId, date)],
    60,
    async () => {
      const supabase = createAnonClient();
      const { data } = await supabase
        .from("staff_attendance")
        .select("marked_at")
        .eq("school_id", schoolId)
        .eq("profile_id", profileId)
        .eq("date", date)
        .maybeSingle();
      return (data as { marked_at?: string } | null)?.marked_at ?? null;
    },
  );
}
