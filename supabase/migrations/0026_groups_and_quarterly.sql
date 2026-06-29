-- Multi-GROUP tenancy: introduce a `groups` layer ABOVE schools so the ERP can
-- host more than one franchise (Adeshwar + Tagore) from one codebase and DB.
-- Each group owns its branding (name, logo, domain) and a set of schools /
-- institutes. Also adds the 'quarterly' fee period kind that Tagore uses.
--
-- Safe + additive: every existing school/profile is backfilled to the Adeshwar
-- group, so the live Adeshwar app is unchanged. Apply manually (SQL editor or
-- MCP) AFTER 0001–0025, in one transaction.

begin;

-- ---------------------------------------------------------------------------
-- 1. groups — the top tenant boundary. Branding is data-driven here so PDFs
--    and the shell can render the right logo/name per group.
-- ---------------------------------------------------------------------------
create table if not exists public.groups (
  id          uuid primary key,
  code        text not null unique,          -- url-safe slug ("adeshwar","tagore")
  name        text not null,                 -- "Adeshwar Public School"
  short_name  text,                          -- "Adeshwar" / "Tagore"
  logo_path   text,                          -- /branding/<code>/logo.* (public/)
  location    text,                          -- "Kondagaon, Chhattisgarh"
  domain      text,                          -- host that resolves to this group
  accent      text,                          -- optional brand accent (hex)
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

insert into public.groups (id, code, name, short_name, logo_path, location, domain, sort_order)
values
  ('10000000-0000-0000-0000-000000000001',
   'adeshwar',
   'Adeshwar Public School',
   'Adeshwar',
   '/branding/aadeshwar/logo.jpeg',
   'Kondagaon, Chhattisgarh',
   null,
   1),
  ('10000000-0000-0000-0000-000000000002',
   'tagore',
   'Tagore Group of Institutions',
   'Tagore',
   '/branding/tagore/logo.png',
   'Sakri, Bilaspur, Chhattisgarh',
   'tagore-erp.vercel.app',
   2)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. schools.group_id — backfill existing (Adeshwar) schools, then NOT NULL.
-- ---------------------------------------------------------------------------
alter table public.schools
  add column if not exists group_id uuid;

update public.schools
   set group_id = '10000000-0000-0000-0000-000000000001'
 where group_id is null;

alter table public.schools alter column group_id set not null;

do $$ begin
  alter table public.schools
    add constraint schools_group_fk
    foreign key (group_id) references public.groups(id) on delete restrict;
exception when duplicate_object then null; end $$;

create index if not exists schools_group_idx on public.schools(group_id);

-- ---------------------------------------------------------------------------
-- 3. Tagore institutes — three "schools" under the Tagore group. Empty until
--    classes/fees are seeded; branding + identity are live immediately.
-- ---------------------------------------------------------------------------
insert into public.schools (id, code, name, location, board, board_code, parent_note, group_id, sort_order)
values
  ('00000000-0000-0000-0000-0000000000a1',
   'tipr',
   'Tagore Institute of Pharmacy & Research',
   'Sakri, Bilaspur, Chhattisgarh',
   'CSVTU',
   null,
   'PCI & DTE Approved · B.Pharm / D.Pharm',
   '10000000-0000-0000-0000-000000000002',
   1),
  ('00000000-0000-0000-0000-0000000000a2',
   'tisbsp',
   'Tagore International School',
   'Sakri, Bilaspur, Chhattisgarh',
   'CBSE',
   '3330506',
   'Play School to Class 10',
   '10000000-0000-0000-0000-000000000002',
   2),
  ('00000000-0000-0000-0000-0000000000a3',
   'tcmbsp',
   'Tagore College of Management',
   'Sakri, Bilaspur, Chhattisgarh',
   'CSVTU',
   null,
   'AICTE Approved · MBA',
   '10000000-0000-0000-0000-000000000002',
   3)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 4. profiles.group_id — every user belongs to exactly one group. Existing
--    users backfill to Adeshwar. New users get it from user_metadata (trigger
--    updated below); default Adeshwar if unset.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists group_id uuid;

update public.profiles
   set group_id = '10000000-0000-0000-0000-000000000001'
 where group_id is null;

alter table public.profiles
  alter column group_id set default '10000000-0000-0000-0000-000000000001';

do $$ begin
  alter table public.profiles
    add constraint profiles_group_fk
    foreign key (group_id) references public.groups(id) on delete restrict;
exception when duplicate_object then null; end $$;

create index if not exists profiles_group_idx on public.profiles(group_id);

-- Extend the new-user trigger to carry group_id from metadata (falls back to
-- Adeshwar). Mirrors the school_ids handling in 0011.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_school_ids uuid[];
  meta_group_id   uuid;
begin
  begin
    select coalesce(array_agg(value::text::uuid), '{}')
      into meta_school_ids
      from jsonb_array_elements_text(coalesce(new.raw_user_meta_data->'school_ids','[]'::jsonb)) as value;
  exception when others then
    meta_school_ids := '{}';
  end;

  begin
    meta_group_id := nullif(new.raw_user_meta_data->>'group_id','')::uuid;
  exception when others then
    meta_group_id := null;
  end;

  insert into public.profiles (id, email, phone, full_name, role, department, school_ids, group_id)
  values (
    new.id,
    new.email,
    coalesce(new.phone, nullif(new.raw_user_meta_data->>'phone','')),
    coalesce(new.raw_user_meta_data->>'full_name',''),
    coalesce(nullif(new.raw_user_meta_data->>'role',''),'staff'),
    nullif(new.raw_user_meta_data->>'department',''),
    meta_school_ids,
    coalesce(meta_group_id, '10000000-0000-0000-0000-000000000001')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. 'quarterly' fee period — Tagore institutes bill in quarters (period_index
--    1..4). Adeshwar's 'monthly' (1..12) is untouched.
-- ---------------------------------------------------------------------------
alter table public.fee_structure_components drop constraint if exists fee_structure_components_kind_check;
alter table public.fee_structure_components
  add constraint fee_structure_components_kind_check
  check (kind in (
    'registration','caution','admission_one_time',
    'yearly','monthly','quarterly','instalment'));

-- ---------------------------------------------------------------------------
-- 6. Permissive RLS for groups — matches the anon_all_* convention; authz is
--    enforced in the app layer.
-- ---------------------------------------------------------------------------
alter table public.groups enable row level security;
drop policy if exists anon_all_groups on public.groups;
create policy anon_all_groups on public.groups for all using (true) with check (true);

commit;
