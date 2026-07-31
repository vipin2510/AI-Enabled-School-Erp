-- Cashbook / daily payment tracking.
--
-- The cashbook tracks physical cash-in-hand per school. Collections come from
-- the existing `erp.invoices` (grouped by payment_mode + date), so they are NOT
-- duplicated here. This migration adds only the two manual out-flows and the
-- per-school opening balance:
--
--   • cashbook_settings — the one-time opening cash balance (e.g. 1 April) that
--     seeds the running cash-in-hand; every later day's opening = prior closing.
--   • cashbook_expenses — office spend, categorised by payment mode
--     (cash/cheque/upi/inb = internet banking).
--   • bank_deposits     — cash taken out of hand and deposited to the bank,
--     with the deposit slip / receipt details.
--
-- Note: this is distinct from public.expenses (migration 0019), which is a
-- staff reimbursement-approval workflow, not accounting.
--
-- Permissive RLS to match the rest of the app — gating happens in the server
-- actions (requireDepartment("fees"); setOpeningBalance is admin-only).
-- Apply manually (Supabase SQL editor) — see CLAUDE.md.

create table if not exists erp.cashbook_settings (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references erp.schools(id) on delete cascade,
  opening_balance numeric(12,2) not null default 0,
  opening_date    date,
  updated_at      timestamptz not null default now(),
  unique (school_id)
);

create table if not exists erp.cashbook_expenses (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references erp.schools(id) on delete cascade,
  spent_on      date not null default (now() at time zone 'Asia/Kolkata')::date,
  mode          text not null default 'cash'
                check (mode in ('cash', 'cheque', 'upi', 'inb')),
  category      text,
  description   text not null,
  amount        numeric(12,2) not null check (amount >= 0),
  created_by    text,
  created_at    timestamptz not null default now()
);

create table if not exists erp.bank_deposits (
  id                 uuid primary key default gen_random_uuid(),
  school_id          uuid not null references erp.schools(id) on delete cascade,
  deposited_on       date not null default (now() at time zone 'Asia/Kolkata')::date,
  amount             numeric(12,2) not null check (amount >= 0),
  bank_name          text,
  deposit_receipt_no text,
  reference          text,
  notes              text,
  created_by         text,
  created_at         timestamptz not null default now()
);

create index if not exists cashbook_expenses_school_date_idx on erp.cashbook_expenses (school_id, spent_on);
create index if not exists bank_deposits_school_date_idx      on erp.bank_deposits (school_id, deposited_on);

grant all on erp.cashbook_settings to anon, authenticated, service_role;
grant all on erp.cashbook_expenses to anon, authenticated, service_role;
grant all on erp.bank_deposits     to anon, authenticated, service_role;

alter table erp.cashbook_settings enable row level security;
alter table erp.cashbook_expenses enable row level security;
alter table erp.bank_deposits     enable row level security;

drop policy if exists anon_all_cashbook_settings on erp.cashbook_settings;
create policy anon_all_cashbook_settings on erp.cashbook_settings for all using (true) with check (true);
drop policy if exists anon_all_cashbook_expenses on erp.cashbook_expenses;
create policy anon_all_cashbook_expenses on erp.cashbook_expenses for all using (true) with check (true);
drop policy if exists anon_all_bank_deposits on erp.bank_deposits;
create policy anon_all_bank_deposits on erp.bank_deposits for all using (true) with check (true);

notify pgrst, 'reload schema';
