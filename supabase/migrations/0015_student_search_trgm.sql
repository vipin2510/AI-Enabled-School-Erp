-- 0015_student_search_trgm.sql
--
-- Index-backed substring search for the screens that currently do
-- `ILIKE '%term%'` against students/invoices:
--   • Collect Fee picker  — students.full_name / contact_number / father_name
--   • Academics roster    — students.full_name / admission_no
--   • Receipts list       — invoices.receipt_no
--
-- Plain b-tree indexes can only accelerate left-anchored matches (`'term%'`).
-- `%term%` requires a trigram index, which pg_trgm provides. Each GIN index
-- is small (the columns are short text) and the inserts are infrequent
-- (rosters change by hundreds, not thousands, a year per school), so the
-- write overhead is a rounding error.
--
-- Originally tracked as the planned "0014_student_search_trgm.sql" in
-- improvement.md. 0014 was already taken by invoice idempotency, so the
-- file is filed under 0015 — the work is the same.

create extension if not exists pg_trgm;

-- Students: three search-by-text columns, all used by the Collect Fee picker
-- and Academics roster.
create index if not exists students_full_name_trgm_idx
  on public.students using gin (full_name gin_trgm_ops);

create index if not exists students_contact_number_trgm_idx
  on public.students using gin (contact_number gin_trgm_ops);

create index if not exists students_father_name_trgm_idx
  on public.students using gin (father_name gin_trgm_ops);

create index if not exists students_admission_no_trgm_idx
  on public.students using gin (admission_no gin_trgm_ops);

-- Invoices: receipt_no powers the Receipts search. Names are searched via the
-- embedded students.full_name index above (Supabase compiles the embed to a
-- JOIN, which uses students_full_name_trgm_idx).
create index if not exists invoices_receipt_no_trgm_idx
  on public.invoices using gin (receipt_no gin_trgm_ops);
