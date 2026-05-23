-- 0004_dedup_and_due_day.sql
-- Fixes the duplicate fee-structure problem and adds a configurable
-- "last fee date of the month" (monthly due day) used for late-fee calc.
--
-- WHY duplicates happened: the unique key on fee_structures includes
-- group_label (NULL for school rows) and class_id (NULL for hostel rows).
-- Postgres treats NULLs as DISTINCT in unique constraints, so the
-- `on conflict` guard in the seed never fired and every re-seed inserted
-- another copy. We rebuild the key with NULLS NOT DISTINCT (PG 15+).

-- ---------------------------------------------------------------------------
-- 1. De-duplicate existing rows (keep the earliest of each logical key).
--    Components of removed structures cascade away via FK on delete cascade.
-- ---------------------------------------------------------------------------
with ranked as (
  select id,
         row_number() over (
           partition by academic_year, scope, class_id, group_label, student_kind
           order by created_at, id
         ) as rn
  from public.fee_structures
)
delete from public.fee_structures fs
using ranked
where fs.id = ranked.id
  and ranked.rn > 1;

-- ---------------------------------------------------------------------------
-- 2. Replace the NULL-distinct unique constraint with a NULLS NOT DISTINCT
--    unique index so future re-seeds upsert instead of duplicating.
-- ---------------------------------------------------------------------------
do $$
declare
  c text;
begin
  -- Drop any existing unique constraint on the table (auto-generated name).
  for c in
    select conname from pg_constraint
    where conrelid = 'public.fee_structures'::regclass and contype = 'u'
  loop
    execute format('alter table public.fee_structures drop constraint %I;', c);
  end loop;
end$$;

drop index if exists public.fee_structures_uniq;
create unique index fee_structures_uniq
  on public.fee_structures (academic_year, scope, class_id, group_label, student_kind)
  nulls not distinct;

-- ---------------------------------------------------------------------------
-- 3. Configurable monthly due day (the "last fee date of the month").
--    e.g. 10 => monthly fees are due by the 10th every month; late fee
--    accrues per day after that.
-- ---------------------------------------------------------------------------
alter table public.late_fee_settings
  add column if not exists monthly_due_day int not null default 10;

-- keep it sane (1..28 so every month has the day)
alter table public.late_fee_settings
  drop constraint if exists late_fee_settings_due_day_chk;
alter table public.late_fee_settings
  add constraint late_fee_settings_due_day_chk
  check (monthly_due_day between 1 and 28);
