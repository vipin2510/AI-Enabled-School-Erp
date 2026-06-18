-- Per-month bus fee paid/unpaid tracking for each student. A row's
-- existence means the month is paid; absence means it isn't. month_index
-- is the calendar month (1=Jan … 12=Dec) — the UI lays them out in the
-- school year order (Apr → Mar).
--
-- Permissive RLS to match the rest of the app — gating happens in server
-- actions via requireDepartment("academics").

create table if not exists public.student_bus_fee_months (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references public.schools(id) on delete cascade,
  student_id      uuid not null references public.students(id) on delete cascade,
  academic_year   text not null,                    -- "2026-27"
  month_index     int  not null check (month_index between 1 and 12),
  paid_at         timestamptz not null default now(),
  marked_by       uuid references auth.users(id) on delete set null,
  unique (student_id, academic_year, month_index)
);

create index if not exists sbfm_student_idx
  on public.student_bus_fee_months (student_id, academic_year);
create index if not exists sbfm_school_idx
  on public.student_bus_fee_months (school_id);

alter table public.student_bus_fee_months enable row level security;
drop policy if exists anon_all_student_bus_fee_months on public.student_bus_fee_months;
create policy anon_all_student_bus_fee_months
  on public.student_bus_fee_months
  for all using (true) with check (true);

grant all on public.student_bus_fee_months to anon, authenticated, service_role;
