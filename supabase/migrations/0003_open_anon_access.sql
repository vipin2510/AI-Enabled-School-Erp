-- 0003_open_anon_access.sql
-- Make every fees-module table fully readable & writable by the `anon` role
-- (the role the `sb_publishable_*` key authenticates as) and by `authenticated`.
--
-- Strategy: GRANTs + RLS *enabled* with permissive policies (USING true / WITH CHECK true).
-- We use policies (not just `DISABLE ROW LEVEL SECURITY`) because the new
-- Supabase publishable API keys may still gate access through RLS in some
-- regions/projects even when RLS is disabled — policies are the bullet-proof
-- path. Tighten or remove these once you add real auth.

-- ---------------------------------------------------------------------------
-- 1. Schema-level GRANTs
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;

alter default privileges in schema public
  grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Per-table RLS + permissive policy
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  fees_tables text[] := array[
    'classes',
    'students',
    'fee_structures',
    'fee_structure_components',
    'late_fee_settings',
    'invoices',
    'invoice_items',
    'payments'
  ];
begin
  foreach t in array fees_tables loop
    -- Enable RLS (idempotent)
    execute format('alter table public.%I enable row level security;', t);

    -- Drop any previous open-access policy so we can redefine cleanly
    execute format('drop policy if exists "anon_all_%s" on public.%I;', t, t);

    -- Create a single policy that allows every action for anon + authenticated
    execute format($p$
      create policy "anon_all_%s" on public.%I
        for all
        to anon, authenticated
        using (true)
        with check (true);
    $p$, t, t);
  end loop;
end$$;

-- ---------------------------------------------------------------------------
-- 3. Bootstrap row that 0001 tries to insert (idempotent re-do, in case the
--    earlier insert was hidden by RLS at the time).
-- ---------------------------------------------------------------------------
insert into public.late_fee_settings (per_day_amount, grace_days, is_enabled)
select 100, 0, true
where not exists (select 1 from public.late_fee_settings);
