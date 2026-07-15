-- 0030_timetable_slots.sql
-- Persistent, editable timetable (replaces the old in-memory generator).
--
-- One row per filled teaching slot for a class+section. Period 1 of every day
-- is the CLASS TEACHER's period and is NOT stored here — it is derived from
-- erp.class_teachers so it always tracks the current class-teacher assignment.
-- Only periods 2..8 (Mon–Fri) / 2..5 (Sat) live in this table.
--
-- Day: 1=Mon … 6=Sat. Mon–Fri run 8 periods, Sat runs 5 (45 periods/week).
--
-- Apply manually (Supabase SQL editor or MCP), like every migration here.

create table if not exists erp.timetable_slots (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references erp.schools(id)  on delete cascade,
  class_id     uuid not null references erp.classes(id)  on delete cascade,
  section      text not null default '',
  day          smallint not null check (day between 1 and 6),
  period       smallint not null check (period between 1 and 8),
  subject_name text,
  teacher_id   uuid references erp.profiles(id) on delete set null,
  updated_at   timestamptz not null default now(),
  unique (school_id, class_id, section, day, period)
);

create index if not exists timetable_slots_class_idx
  on erp.timetable_slots(school_id, class_id, section);
create index if not exists timetable_slots_teacher_idx
  on erp.timetable_slots(teacher_id);

-- GRANTs + permissive RLS (anon_all_* convention; auth is enforced app-side).
grant all on erp.timetable_slots to anon, authenticated, service_role;

alter table erp.timetable_slots enable row level security;
drop policy if exists anon_all_timetable_slots on erp.timetable_slots;
create policy anon_all_timetable_slots on erp.timetable_slots
  for all to anon, authenticated using (true) with check (true);

notify pgrst, 'reload schema';
