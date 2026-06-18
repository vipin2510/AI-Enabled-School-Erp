-- Expense submissions: staff / managers raise an expense for reimbursement
-- or office-spend approval; admin (Layer 1) reviews and approves or
-- declines with an optional note. Full audit trail is the table itself
-- (decided_by + decided_at + decision_note are immutable after a decision).
--
-- Permissive RLS to match the rest of the app — gating happens in server
-- actions via requireDepartment("fees") / requireRole("admin").

create table if not exists public.expenses (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references public.schools(id) on delete cascade,
  raised_by       uuid not null references auth.users(id) on delete cascade,
  amount          numeric(12,2) not null check (amount >= 0),
  category        text,                  -- free-text bucket: travel, supplies, …
  description     text not null,
  spent_on        date,                  -- optional date the spend happened
  status          text not null default 'pending'
                  check (status in ('pending', 'approved', 'declined')),
  decided_by      uuid references auth.users(id) on delete set null,
  decided_at      timestamptz,
  decision_note   text,
  created_at      timestamptz not null default now()
);

create index if not exists expenses_school_idx       on public.expenses (school_id);
create index if not exists expenses_raised_by_idx    on public.expenses (raised_by);
create index if not exists expenses_status_idx       on public.expenses (status);
create index if not exists expenses_created_at_idx   on public.expenses (created_at desc);

alter table public.expenses enable row level security;
drop policy if exists anon_all_expenses on public.expenses;
create policy anon_all_expenses on public.expenses for all using (true) with check (true);

grant all on public.expenses to anon, authenticated, service_role;
