-- 0010_staff_attendance_and_book_requests.sql
-- 1) Staff attendance: Layer 2 (manager) and Layer 3 (staff) mark themselves
--    present once a day from their device; we capture the time + geolocation.
--    Admin (Layer 1) reviews it. One row per (profile, date).
-- 2) Book requests: an acquisition wishlist the librarian keeps for titles that
--    aren't in the catalog yet but students have asked for.

-- ---------------------------------------------------------------------------
-- Staff attendance
-- ---------------------------------------------------------------------------
create table if not exists public.staff_attendance (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  date        date not null,
  marked_at   timestamptz not null default now(),
  latitude    double precision,
  longitude   double precision,
  accuracy    double precision,
  created_at  timestamptz not null default now(),
  unique (profile_id, date)
);
create index if not exists staff_attendance_date_idx    on public.staff_attendance(date);
create index if not exists staff_attendance_profile_idx on public.staff_attendance(profile_id);

-- ---------------------------------------------------------------------------
-- Book requests (acquisition wishlist)
-- ---------------------------------------------------------------------------
create table if not exists public.book_requests (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  author        text,
  requested_for text,                    -- student / class who asked
  note          text,
  status        text not null default 'open' check (status in ('open','fulfilled')),
  created_at    timestamptz not null default now(),
  fulfilled_at  timestamptz
);
create index if not exists book_requests_status_idx on public.book_requests(status);

-- ---------------------------------------------------------------------------
-- Grants + permissive RLS (access is gated in the app, like the other tables).
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

do $$
declare
  t text;
  open_tables text[] := array['staff_attendance', 'book_requests'];
begin
  foreach t in array open_tables loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "anon_all_%s" on public.%I;', t, t);
    execute format($p$
      create policy "anon_all_%s" on public.%I
        for all to anon, authenticated using (true) with check (true);
    $p$, t, t);
  end loop;
end$$;
