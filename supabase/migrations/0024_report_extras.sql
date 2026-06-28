-- Extra (non-scholastic) report-card values entered per student, per exam:
-- the dictation / handwriting marks, the moral-science / drawing / SUPW
-- grades, and the working-days / days-present counts that sit below the
-- subject table on the school marksheet. Computed rows (rank, highest in
-- class, result, percentage, grade) are NOT stored here — they're derived
-- at render time.
--
-- One row per (student, year, exam, field). `value` is text so the same
-- table holds marks ("8"), grades ("A") and counts ("210") — the field's
-- kind (see EXTRA_FIELDS in src/lib/results.ts) decides how to read it.
--
-- Permissive RLS to match the rest of the app — gating happens in the
-- results actions via requireDepartment("results").

create table if not exists public.report_extras (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.students(id) on delete cascade,
  school_id     uuid not null references public.schools(id) on delete cascade,
  academic_year text not null,
  exam          text not null,   -- ut1..ut4, terminal, terminal2, terminal3
  field         text not null,   -- eng_dictation … days_present
  value         text,            -- marks / grade letter / day count, as text
  updated_at    timestamptz not null default now(),
  unique (student_id, academic_year, exam, field)
);

create index if not exists report_extras_student_year_idx
  on public.report_extras (student_id, academic_year);
create index if not exists report_extras_school_idx
  on public.report_extras (school_id);

alter table public.report_extras enable row level security;
drop policy if exists anon_all_report_extras on public.report_extras;
create policy anon_all_report_extras on public.report_extras for all using (true) with check (true);

grant all on public.report_extras to anon, authenticated, service_role;
