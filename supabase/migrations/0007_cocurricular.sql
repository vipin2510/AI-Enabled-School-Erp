-- 0007_cocurricular.sql
-- Splits subjects into scholastic (numeric marks, the existing flow) vs
-- co-curricular (a single A–E grade per academic year, kept out of the
-- academic percentage). Adds the grade store for the latter.

-- Tag each subject. Existing subjects default to 'scholastic'.
alter table public.subjects
  add column if not exists category text not null default 'scholastic'
    check (category in ('scholastic', 'co_curricular'));

-- One letter grade per (student, co-curricular subject, academic year).
create table if not exists public.co_curricular_grades (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.students(id) on delete cascade,
  subject_id    uuid not null references public.subjects(id) on delete cascade,
  academic_year text not null,
  grade         text check (grade in ('A','B','C','D','E')),
  updated_at    timestamptz not null default now(),
  unique (student_id, subject_id, academic_year)
);
create index if not exists ccg_student_idx on public.co_curricular_grades(student_id);
create index if not exists ccg_year_idx     on public.co_curricular_grades(academic_year);

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

alter table public.co_curricular_grades enable row level security;
drop policy if exists "anon_all_co_curricular_grades" on public.co_curricular_grades;
create policy "anon_all_co_curricular_grades" on public.co_curricular_grades
  for all
  to anon, authenticated
  using (true)
  with check (true);
