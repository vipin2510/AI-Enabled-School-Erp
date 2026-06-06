-- Pre-deployment data wipe: clear ALL test transactional data across every
-- department so the live system starts with a clean slate. Master data is
-- preserved (students roster, classes/sections/subjects, fee structures,
-- books catalog, library_settings, late_fee_settings, profiles, schools).
--
-- Wipe each block in FK-safe order. CASCADE picks up anything FK-linked.
-- Run this *only* before going live; do not include in dev seed.

-- ── Fees ────────────────────────────────────────────────────────────────────
-- Order: payments -> invoice_items -> invoices (FK children first).
truncate table public.payments restart identity cascade;
truncate table public.invoice_items restart identity cascade;
truncate table public.invoices restart identity cascade;

-- ── Academics: attendance ───────────────────────────────────────────────────
-- Student daily attendance + staff daily attendance.
truncate table public.attendance restart identity cascade;
truncate table public.staff_attendance restart identity cascade;

-- ── Library ─────────────────────────────────────────────────────────────────
-- Loans (issue/return) and book request queue. Catalog (books) and settings
-- (library_settings) are master data and stay.
truncate table public.book_loans restart identity cascade;
truncate table public.book_requests restart identity cascade;

-- ── Results ─────────────────────────────────────────────────────────────────
-- Per-student per-exam marks plus annual co-curricular grades. Subjects +
-- exam scheme are config and stay.
truncate table public.marks restart identity cascade;
truncate table public.co_curricular_grades restart identity cascade;

-- ── Cross-cutting: change requests ──────────────────────────────────────────
truncate table public.change_requests restart identity cascade;

-- ── Sequences ───────────────────────────────────────────────────────────────
-- Reset any separately-owned sequences so the first real entries start at 1.
-- TRUNCATE … RESTART IDENTITY above already resets owned sequences; this
-- handles any that were created independently (e.g. a receipt-number seq).
do $$
declare
  s text;
begin
  for s in
    select sequencename from pg_sequences
    where schemaname = 'public'
      and sequencename in (
        'invoices_receipt_seq',
        'invoices_receipt_no_seq',
        'receipt_no_seq'
      )
  loop
    execute format('alter sequence public.%I restart with 1', s);
  end loop;
end $$;
