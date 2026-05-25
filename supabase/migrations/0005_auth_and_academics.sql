-- 0005_auth_and_academics.sql
-- Three-layer login (admin / manager / staff) + academic master data
-- (class sections and subjects) used by the Students/Classes/Subjects screens.
--
-- Auth itself is Supabase Auth (auth.users). This migration adds the app-side
-- "profile" that carries the role + department, plus a change-request inbox and
-- the academic tables. Data-table access stays app-gated (see proxy.ts + the
-- auth DAL); RLS here mirrors the permissive style of the earlier migrations.

-- ---------------------------------------------------------------------------
-- Profiles — one per auth user.
--   role:       'admin'   (Layer 1) full access, creates logins
--               'manager' (Layer 2) sees every department, can raise requests
--               'staff'   (Layer 3) one department only
--   department: required for staff; null for admin/manager.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  role        text not null default 'staff' check (role in ('admin','manager','staff')),
  department  text check (department in ('fees','library','results')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists profiles_role_idx on public.profiles(role);

-- Create the profile row automatically when an auth user is created. The admin
-- "create user" call stuffs full_name / role / department into user metadata,
-- which we read here so a profile always exists with the right access.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, department)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'staff'),
    nullif(new.raw_user_meta_data->>'department', '')
  )
  on conflict (id) do nothing;
  return new;
end$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Change requests — Layer 2 (manager) asks Layer 1 (admin) for a change.
-- ---------------------------------------------------------------------------
create table if not exists public.change_requests (
  id              uuid primary key default gen_random_uuid(),
  requested_by    uuid references public.profiles(id) on delete set null,
  requester_email text,
  subject         text not null,
  body            text not null,
  status          text not null default 'open' check (status in ('open','resolved')),
  admin_note      text,
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz
);
create index if not exists change_requests_status_idx on public.change_requests(status);

-- ---------------------------------------------------------------------------
-- Sections per class (e.g. class 1st → A, B). Created/destroyed from the
-- Classes screen.
-- ---------------------------------------------------------------------------
create table if not exists public.sections (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references public.classes(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  unique (class_id, name)
);
create index if not exists sections_class_idx on public.sections(class_id);

-- ---------------------------------------------------------------------------
-- Subjects per class. Altered from the Subjects screen.
-- ---------------------------------------------------------------------------
create table if not exists public.subjects (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references public.classes(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  unique (class_id, name)
);
create index if not exists subjects_class_idx on public.subjects(class_id);

-- ---------------------------------------------------------------------------
-- Grants + RLS.
-- Academic tables + change_requests follow the permissive pattern of the
-- earlier migrations (access is gated in the app by role). Profiles are
-- read-only to authenticated users; writes go through the service-role admin
-- client, which bypasses RLS.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

-- profiles
alter table public.profiles enable row level security;
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to anon, authenticated using (true);
drop policy if exists profiles_service on public.profiles;
create policy profiles_service on public.profiles
  for all to service_role using (true) with check (true);

-- change_requests / sections / subjects — permissive (app-gated)
do $$
declare
  t text;
  open_tables text[] := array['change_requests', 'sections', 'subjects'];
begin
  foreach t in array open_tables loop
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
