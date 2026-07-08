-- ============================================================================
-- Adeshwar go-live cleanup — wipe TEST TRANSACTIONS, keep MASTER DATA.
--
-- Run once in the Supabase SQL editor before Adeshwar goes live. Scoped
-- strictly to the three Adeshwar school_ids, so Tagore and the unrelated app
-- sharing this database are never touched.
--
-- CLEARS : attendance, staff_attendance, invoices + invoice_items + payments,
--          marks, report_extras, co_curricular_grades, expenses
-- KEEPS  : students, classes, sections, subjects, fee_structures + components,
--          books, library/late-fee/print settings, profiles (users)
--
-- Wrapped in a transaction: it all applies or none of it does.
-- ============================================================================

begin;

-- Adeshwar schools: Kondagaon, Pharasgaon, Chipawand.
-- (Using a temp list keeps every DELETE identical and hard to mis-scope.)
create temporary table _adeshwar_schools (id uuid) on commit drop;
insert into _adeshwar_schools (id) values
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000003');

-- ── Fees (children before parent) ──────────────────────────────────────────
delete from public.payments      where school_id in (select id from _adeshwar_schools);
delete from public.invoice_items where school_id in (select id from _adeshwar_schools);
delete from public.invoices      where school_id in (select id from _adeshwar_schools);

-- ── Attendance ─────────────────────────────────────────────────────────────
delete from public.attendance        where school_id in (select id from _adeshwar_schools);
delete from public.staff_attendance  where school_id in (select id from _adeshwar_schools);

-- ── Results / marks ────────────────────────────────────────────────────────
delete from public.marks                 where school_id in (select id from _adeshwar_schools);
delete from public.report_extras         where school_id in (select id from _adeshwar_schools);
delete from public.co_curricular_grades  where school_id in (select id from _adeshwar_schools);

-- ── Expenses ───────────────────────────────────────────────────────────────
delete from public.expenses where school_id in (select id from _adeshwar_schools);

commit;

-- ── Verify (should all be 0) ───────────────────────────────────────────────
-- Run this after committing to confirm the wipe:
--
-- select 'attendance' t, count(*) from public.attendance
--   where school_id in ('00000000-0000-0000-0000-000000000001',
--                       '00000000-0000-0000-0000-000000000002',
--                       '00000000-0000-0000-0000-000000000003')
-- union all select 'invoices', count(*) from public.invoices
--   where school_id in ('00000000-0000-0000-0000-000000000001',
--                       '00000000-0000-0000-0000-000000000002',
--                       '00000000-0000-0000-0000-000000000003')
-- union all select 'marks', count(*) from public.marks
--   where school_id in ('00000000-0000-0000-0000-000000000001',
--                       '00000000-0000-0000-0000-000000000002',
--                       '00000000-0000-0000-0000-000000000003');
