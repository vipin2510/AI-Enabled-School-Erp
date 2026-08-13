-- 0036_remedial_timetable.sql
-- Two changes:
--   1. Period 1 is now a normal editable slot (no longer derived from the
--      class teacher), so the timetable grid stores periods 1..8. The DB check
--      already allowed period 1, so no column change is needed there.
--   2. Each class/section can have a SECOND, independent "remedial" timetable
--      alongside its regular one. We add a `kind` discriminator to
--      erp.timetable_slots and widen its unique key to include it, plus a small
--      table holding the remedial timetable's validity window (from → till).
--
-- Apply manually (Supabase SQL editor or MCP), like every migration here.

-- 1. Discriminator: 'regular' (default, curricular) vs 'remedial'.
alter table erp.timetable_slots
  add column if not exists kind text not null default 'regular'
  check (kind in ('regular', 'remedial'));

-- Widen the uniqueness to be per-kind so the regular and remedial grids for the
-- same class/section/day/period can coexist.
alter table erp.timetable_slots
  drop constraint if exists timetable_slots_school_id_class_id_section_day_period_key;
-- (older auto-generated name variant, just in case)
alter table erp.timetable_slots
  drop constraint if exists timetable_slots_school_id_class_id_section_day_period_key1;

create unique index if not exists timetable_slots_unique_slot
  on erp.timetable_slots (school_id, class_id, section, kind, day, period);

-- 2. Validity window for a class/section's remedial timetable.
create table if not exists erp.remedial_timetables (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references erp.schools(id) on delete cascade,
  class_id   uuid not null references erp.classes(id) on delete cascade,
  section    text not null default '',
  start_date date,
  end_date   date,
  updated_at timestamptz not null default now(),
  unique (school_id, class_id, section)
);

create index if not exists remedial_timetables_class_idx
  on erp.remedial_timetables(school_id, class_id, section);

-- GRANTs + permissive RLS (anon_all_* convention; auth is enforced app-side).
grant all on erp.remedial_timetables to anon, authenticated, service_role;

alter table erp.remedial_timetables enable row level security;
drop policy if exists anon_all_remedial_timetables on erp.remedial_timetables;
create policy anon_all_remedial_timetables on erp.remedial_timetables
  for all to anon, authenticated using (true) with check (true);

notify pgrst, 'reload schema';
