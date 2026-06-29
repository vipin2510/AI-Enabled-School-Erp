-- Restore anon SELECT on profiles — fixes login.
--
-- Login reads the signed-in user's profile through a COOKIE-LESS client
-- (src/lib/auth.ts → loadProfileById → createAnonClient, used inside the
-- cached() callback), so RLS evaluates that read as the `anon` role, not
-- `authenticated`. If the permissive select policy is missing, the read
-- returns zero rows and the app treats every valid login as an inactive
-- account — the login "crash".
--
-- This policy was originally created in 0005_auth_and_academics.sql but was
-- dropped/altered out-of-band on the shared Supabase project. Re-apply it.
-- Authorization is enforced in the app layer (see CLAUDE.md), so a permissive
-- read here is intentional.

alter table public.profiles enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to anon, authenticated using (true);

drop policy if exists profiles_service on public.profiles;
create policy profiles_service on public.profiles
  for all to service_role using (true) with check (true);
