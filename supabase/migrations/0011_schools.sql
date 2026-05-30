-- Multi-school franchise: introduce `schools`, scope every data table by
-- `school_id`, and extend `profiles` with phone-based login + multi-school
-- access (school_ids[]). Existing data is backfilled to the Kondagaon school
-- (the only one live before this migration).
--
-- Apply order: this migration assumes 0001–0010 have already run. Apply it
-- manually via the Supabase SQL editor or MCP, in one transaction.

begin;

-- ---------------------------------------------------------------------------
-- 1. schools
-- ---------------------------------------------------------------------------
create table if not exists public.schools (
  id          uuid primary key,
  code        text not null unique,           -- short slug used in URLs/cookies
  name        text not null,
  location    text not null,                  -- "Kondagaon, Chhattisgarh"
  board       text,                           -- "CISCE" / "CBSE" / …
  board_code  text,                           -- e.g. "CG 024"
  parent_note text,                           -- unit-of disclosure for branches
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

insert into public.schools (id, code, name, location, board, board_code, parent_note, sort_order)
values
  ('00000000-0000-0000-0000-000000000001',
   'kondagaon',
   'Adeshwar Public School',
   'Kondagaon, Chhattisgarh',
   'CISCE',
   'CG 024',
   null,
   1),
  ('00000000-0000-0000-0000-000000000002',
   'pharasgaon',
   'Adeshwar Public School',
   'Pharasgaon, Chhattisgarh',
   null,
   null,
   'A Unit of Adeshwar Public School, Kondagaon, C.G.',
   2),
  ('00000000-0000-0000-0000-000000000003',
   'chipawand',
   'Adeshwar Public School',
   'Chipawand, Chhattisgarh',
   null,
   null,
   'A Unit of Adeshwar Public School, Kondagaon, C.G.',
   3)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. profiles: phone login + multi-school access
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists phone       text,
  add column if not exists school_ids  uuid[] not null default '{}';

-- One profile per phone, but allow nulls for legacy email-only accounts.
create unique index if not exists profiles_phone_uniq
  on public.profiles(phone)
  where phone is not null;

-- 0005 forgot 'academics' in the department check; fix that here so seeded
-- academics staff don't violate the constraint after this migration.
alter table public.profiles drop constraint if exists profiles_department_check;
alter table public.profiles
  add constraint profiles_department_check
  check (department is null or department in ('fees','academics','library','results'));

-- Every existing profile defaults to access to Kondagaon (the only school
-- live before this migration). Admins are widened to all three schools so
-- existing logins don't lock themselves out of the franchise.
update public.profiles
   set school_ids = case
     when role = 'admin' then array[
       '00000000-0000-0000-0000-000000000001'::uuid,
       '00000000-0000-0000-0000-000000000002'::uuid,
       '00000000-0000-0000-0000-000000000003'::uuid
     ]
     else array['00000000-0000-0000-0000-000000000001'::uuid]
   end
 where school_ids = '{}';

-- Re-seed the trigger so newly created users get phone + school_ids from the
-- user_metadata that the admin "create user" action sets.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_school_ids uuid[];
begin
  -- school_ids comes in as a JSON array of uuid strings.
  begin
    select coalesce(array_agg(value::text::uuid), '{}')
      into meta_school_ids
      from jsonb_array_elements_text(coalesce(new.raw_user_meta_data->'school_ids','[]'::jsonb)) as value;
  exception when others then
    meta_school_ids := '{}';
  end;

  insert into public.profiles (id, email, phone, full_name, role, department, school_ids)
  values (
    new.id,
    new.email,
    coalesce(new.phone, nullif(new.raw_user_meta_data->>'phone','')),
    coalesce(new.raw_user_meta_data->>'full_name',''),
    coalesce(nullif(new.raw_user_meta_data->>'role',''),'staff'),
    nullif(new.raw_user_meta_data->>'department',''),
    meta_school_ids
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. school_id on every data table — backfilled to Kondagaon, then NOT NULL
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  kondagaon constant uuid := '00000000-0000-0000-0000-000000000001';
  tables constant text[] := array[
    'students','classes','sections','subjects',
    'fee_structures','fee_structure_components',
    'invoices','invoice_items','payments',
    'late_fee_settings',
    'attendance','staff_attendance',
    'books','book_loans','book_requests','library_settings',
    'marks','co_curricular_grades',
    'change_requests'
  ];
begin
  foreach t in array tables loop
    -- Add the column (nullable first so we can backfill).
    execute format('alter table public.%I add column if not exists school_id uuid', t);
    -- Backfill any null rows to Kondagaon.
    execute format('update public.%I set school_id = $1 where school_id is null', t)
      using kondagaon;
    -- NOT NULL.
    execute format('alter table public.%I alter column school_id set not null', t);
    -- FK (guard against re-runs).
    begin
      execute format(
        'alter table public.%I
           add constraint %I foreign key (school_id) references public.schools(id) on delete restrict',
        t, t || '_school_fk'
      );
    exception when duplicate_object then null;
    end;
    -- Index.
    execute format(
      'create index if not exists %I on public.%I (school_id)',
      t || '_school_idx', t
    );
  end loop;
end$$;

-- ---------------------------------------------------------------------------
-- 4. Permissive RLS for the new table — matches the existing anon_all_*
--    policy convention. Authz is enforced in the app layer.
-- ---------------------------------------------------------------------------
alter table public.schools enable row level security;
drop policy if exists anon_all_schools on public.schools;
create policy anon_all_schools on public.schools for all using (true) with check (true);

commit;
