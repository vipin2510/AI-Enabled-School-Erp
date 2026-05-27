-- 0009_attendance.sql
-- Daily, one-mark-per-day student attendance. Taken class-wise on working days
-- (Sundays/holidays simply have no rows). One row per (student, date); the
-- class_id/section are snapshotted for class-wise reporting.

create table if not exists public.attendance (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.students(id) on delete cascade,
  class_id    uuid references public.classes(id) on delete set null,
  section     text,
  date        date not null,
  status      text not null default 'present' check (status in ('present','absent')),
  marked_by   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (student_id, date)
);
create index if not exists attendance_student_idx on public.attendance(student_id);
create index if not exists attendance_class_date_idx on public.attendance(class_id, date);
create index if not exists attendance_date_idx on public.attendance(date);

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

alter table public.attendance enable row level security;
drop policy if exists "anon_all_attendance" on public.attendance;
create policy "anon_all_attendance" on public.attendance
  for all to anon, authenticated using (true) with check (true);
