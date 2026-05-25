-- 0006_results.sql
-- Results module: per-student exam marks. One row per
-- (student, subject, exam, academic_year). `max_marks` is snapshotted on the
-- row so a later change to the exam scheme never rewrites historical marks.
-- `marks_obtained` is null when not yet entered / the student was absent.
--
-- Access stays app-gated (Results department staff + admin/manager) exactly
-- like the other academic tables, so RLS here is the same permissive pattern.

create table if not exists public.marks (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references public.students(id) on delete cascade,
  subject_id     uuid not null references public.subjects(id) on delete cascade,
  exam           text not null,            -- 'ut1','ut2','ut3','ut4','terminal'
  academic_year  text not null,            -- e.g. '2026-27'
  marks_obtained numeric(6,2),             -- null = not entered / absent
  max_marks      numeric(6,2) not null default 0,
  updated_at     timestamptz not null default now(),
  unique (student_id, subject_id, exam, academic_year)
);
create index if not exists marks_student_idx on public.marks(student_id);
create index if not exists marks_subject_idx on public.marks(subject_id);
create index if not exists marks_year_idx     on public.marks(academic_year);

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

alter table public.marks enable row level security;
drop policy if exists "anon_all_marks" on public.marks;
create policy "anon_all_marks" on public.marks
  for all
  to anon, authenticated
  using (true)
  with check (true);
