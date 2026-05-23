-- Pathshala ERP — Fees module schema (initial migration)
-- Run this in Supabase SQL editor or via `supabase db push`.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Classes (Play Group → XII, plus 11/12 streams). Used by fee_structures.
-- ---------------------------------------------------------------------------
create table if not exists public.classes (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,            -- e.g. "1ST", "11_SCI"
  display_name  text not null,                   -- "1st", "11th (Sci)"
  ordinal       int  not null,                   -- sort order
  stream        text,                            -- "Sci" | "Com" | null
  group_label   text,                            -- "I TO III" etc. (for hostel)
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Students
-- ---------------------------------------------------------------------------
create table if not exists public.students (
  id              uuid primary key default gen_random_uuid(),
  admission_no    text unique,                   -- nullable until assigned
  full_name       text not null,
  class_id        uuid references public.classes(id) on delete set null,
  section         text,
  gender          text,
  blood_group     text,
  date_of_birth   date,
  father_name     text,
  mother_name     text,
  contact_number  text,
  alt_contact     text,
  address         text,
  is_hosteller    boolean not null default false,
  is_new_admission boolean not null default false, -- true → "NEW ADMISSION" fee row applies
  status          text not null default 'active', -- active | inactive | alumni
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists students_class_idx on public.students(class_id);
create index if not exists students_name_idx  on public.students(full_name);

-- ---------------------------------------------------------------------------
-- Fee structures (one per class per scope per academic year)
-- scope: 'school' | 'hostel'
-- student_kind: 'new' | 'old' | 'any'  (hostel splits new vs old; school doesn't)
-- ---------------------------------------------------------------------------
create table if not exists public.fee_structures (
  id                uuid primary key default gen_random_uuid(),
  academic_year     text not null,               -- "2026-27"
  scope             text not null check (scope in ('school','hostel')),
  class_id          uuid references public.classes(id) on delete cascade,
  group_label       text,                        -- "I TO III" for hostel groupings
  student_kind      text not null default 'any' check (student_kind in ('new','old','any')),
  total_amount      numeric(12,2) not null default 0,
  created_at        timestamptz not null default now(),
  unique (academic_year, scope, class_id, group_label, student_kind)
);

-- ---------------------------------------------------------------------------
-- Fee structure components — what makes up the total.
-- kind:
--   'registration', 'caution', 'admission_one_time',
--   'yearly', 'monthly', 'instalment'
-- For monthly: period_index = month (1..12, where 4=Apr if you want Apr-start).
-- For instalment: period_index = 1..4.
-- due_date is the canonical due date (current academic year).
-- ---------------------------------------------------------------------------
create table if not exists public.fee_structure_components (
  id              uuid primary key default gen_random_uuid(),
  structure_id    uuid not null references public.fee_structures(id) on delete cascade,
  kind            text not null check (kind in (
                    'registration','caution','admission_one_time',
                    'yearly','monthly','instalment')),
  label           text not null,
  period_index    int,                            -- month no. or instalment no.
  amount          numeric(12,2) not null,
  due_date        date,
  is_refundable   boolean not null default false, -- caution money = true
  is_one_time     boolean not null default false, -- registration / admission
  sort_order      int not null default 0
);
create index if not exists fsc_struct_idx on public.fee_structure_components(structure_id);

-- ---------------------------------------------------------------------------
-- Late-fee configuration (single row, editable from settings page).
-- ---------------------------------------------------------------------------
create table if not exists public.late_fee_settings (
  id              uuid primary key default gen_random_uuid(),
  per_day_amount  numeric(10,2) not null default 100,
  grace_days      int not null default 0,
  is_enabled      boolean not null default true,
  updated_at      timestamptz not null default now()
);

insert into public.late_fee_settings (per_day_amount, grace_days, is_enabled)
select 100, 0, true
where not exists (select 1 from public.late_fee_settings);

-- ---------------------------------------------------------------------------
-- Invoices = a paid receipt. One invoice can bundle many fee components
-- (multiple months, full year, instalments, hostel + school together).
-- ---------------------------------------------------------------------------
create table if not exists public.invoices (
  id              uuid primary key default gen_random_uuid(),
  receipt_no      text unique,                   -- generated by trigger below
  student_id      uuid not null references public.students(id) on delete restrict,
  academic_year   text not null,
  issued_at       timestamptz not null default now(),
  subtotal        numeric(12,2) not null default 0,  -- sum of items.amount
  late_fee        numeric(12,2) not null default 0,
  waiver_amount   numeric(12,2) not null default 0,
  total           numeric(12,2) not null default 0,  -- subtotal + late_fee − waiver
  amount_paid     numeric(12,2) not null default 0,
  balance         numeric(12,2) not null default 0,  -- total − amount_paid
  payment_status  text not null default 'pending' check (payment_status in ('pending','partial','paid','void')),
  payment_mode    text,                           -- cash | upi | card | bank | cheque
  payment_ref     text,                           -- txn id / cheque no.
  waiver_reason   text,
  late_fee_waived boolean not null default false,
  notes           text,
  created_by      text,                           -- staff name; full auth later
  created_at      timestamptz not null default now()
);
create index if not exists invoices_student_idx on public.invoices(student_id);
create index if not exists invoices_year_idx    on public.invoices(academic_year);

-- Auto-generate receipt_no like APS/2026-27/000123
create sequence if not exists public.invoice_seq;

create or replace function public.set_receipt_no()
returns trigger language plpgsql as $$
begin
  if new.receipt_no is null then
    new.receipt_no := 'APS/' || new.academic_year || '/' ||
                      lpad(nextval('public.invoice_seq')::text, 6, '0');
  end if;
  return new;
end$$;

drop trigger if exists set_receipt_no_trg on public.invoices;
create trigger set_receipt_no_trg
before insert on public.invoices
for each row execute function public.set_receipt_no();

-- ---------------------------------------------------------------------------
-- Invoice items — each row = one fee component being paid in this invoice.
-- ---------------------------------------------------------------------------
create table if not exists public.invoice_items (
  id              uuid primary key default gen_random_uuid(),
  invoice_id      uuid not null references public.invoices(id) on delete cascade,
  component_id    uuid references public.fee_structure_components(id) on delete set null,
  description     text not null,                   -- snapshot of the label
  kind            text not null,                   -- snapshot of component.kind
  period_index    int,
  amount          numeric(12,2) not null,
  waived          boolean not null default false,
  waiver_reason   text
);
create index if not exists invoice_items_inv_idx on public.invoice_items(invoice_id);

-- ---------------------------------------------------------------------------
-- Payments — a single invoice may be paid in multiple tranches.
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id              uuid primary key default gen_random_uuid(),
  invoice_id      uuid not null references public.invoices(id) on delete cascade,
  amount          numeric(12,2) not null,
  paid_at         timestamptz not null default now(),
  mode            text not null,                   -- cash | upi | card | bank | cheque
  reference       text,
  notes           text
);

-- ---------------------------------------------------------------------------
-- RLS — open for now (user requested "no auth yet").
-- Newer Supabase publishable (sb_publishable_*) keys can enforce RLS even
-- when it's disabled at the table level, so we enable RLS + add permissive
-- policies. Tighten or remove these once auth lands.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

alter default privileges in schema public
  grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;

do $$
declare
  t text;
  fees_tables text[] := array[
    'classes', 'students',
    'fee_structures', 'fee_structure_components',
    'late_fee_settings',
    'invoices', 'invoice_items', 'payments'
  ];
begin
  foreach t in array fees_tables loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "anon_all_%s" on public.%I;', t, t);
    execute format($p$
      create policy "anon_all_%s" on public.%I
        for all
        to anon, authenticated
        using (true)
        with check (true);
    $p$, t, t);
  end loop;
end$$;
