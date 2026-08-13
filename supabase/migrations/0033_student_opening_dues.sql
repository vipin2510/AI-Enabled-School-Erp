-- Per-student carry-forward opening dues.
--
-- Seeds each student's outstanding balance brought forward from a prior
-- session (imported from BALANCE FEE 2025-26.xlsx via scripts/import-balance-fees.ts).
-- These amounts add to the student's Outstanding on the Collect screen and feed
-- the TC "no dues" check. They are NOT invoices — just a starting balance per
-- academic year.
--
-- Permissive RLS to match the rest of the app — gating happens in the app layer.
-- Apply manually (Supabase SQL editor) — see CLAUDE.md.

create table if not exists erp.student_opening_dues (
  id             uuid primary key default gen_random_uuid(),
  school_id      uuid not null references erp.schools(id) on delete cascade,
  student_id     uuid not null references erp.students(id) on delete cascade,
  academic_year  text not null,
  amount         numeric(12,2) not null default 0,
  breakdown      jsonb,
  source         text default 'import 2025-26',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (student_id, academic_year)
);

create index if not exists student_opening_dues_school_idx on erp.student_opening_dues (school_id, academic_year);

grant all on erp.student_opening_dues to anon, authenticated, service_role;

alter table erp.student_opening_dues enable row level security;
drop policy if exists anon_all_student_opening_dues on erp.student_opening_dues;
create policy anon_all_student_opening_dues on erp.student_opening_dues for all using (true) with check (true);

notify pgrst, 'reload schema';
