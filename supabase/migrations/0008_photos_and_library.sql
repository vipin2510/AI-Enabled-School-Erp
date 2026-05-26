-- 0008_photos_and_library.sql
-- 1) Student & parent photos (for the profile screen and printable ID cards),
--    stored in a public Supabase Storage bucket; the students row keeps the URL.
-- 2) Library module: a catalog of physical book copies (each with a scannable
--    unique code), loans, and a single-row settings record.

-- ---------------------------------------------------------------------------
-- Photos
-- ---------------------------------------------------------------------------
alter table public.students
  add column if not exists student_photo_url text,
  add column if not exists parent_photo_url  text;

-- Public bucket for the photos. Uploads go through the service-role admin
-- client (bypasses RLS); reads are public via the returned URL.
insert into storage.buckets (id, name, public)
values ('student-photos', 'student-photos', true)
on conflict (id) do nothing;

drop policy if exists "student_photos_read" on storage.objects;
create policy "student_photos_read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'student-photos');

drop policy if exists "student_photos_write" on storage.objects;
create policy "student_photos_write" on storage.objects
  for all to anon, authenticated
  using (bucket_id = 'student-photos')
  with check (bucket_id = 'student-photos');

-- ---------------------------------------------------------------------------
-- Library — one row per physical copy. `code` is the value printed (as a QR
-- label) on the book and scanned/typed at the desk.
-- ---------------------------------------------------------------------------
create table if not exists public.books (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  title       text not null,
  author      text,
  isbn        text,
  category    text,
  status      text not null default 'active' check (status in ('active','lost','withdrawn')),
  created_at  timestamptz not null default now()
);
create index if not exists books_title_idx on public.books(title);

-- Loans. An open loan = returned_at is null. The active-loan partial unique
-- index stops the same copy being issued twice at once.
create table if not exists public.book_loans (
  id          uuid primary key default gen_random_uuid(),
  book_id     uuid not null references public.books(id) on delete cascade,
  student_id  uuid not null references public.students(id) on delete cascade,
  issued_at   timestamptz not null default now(),
  due_date    date,
  returned_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists book_loans_book_idx    on public.book_loans(book_id);
create index if not exists book_loans_student_idx on public.book_loans(student_id);
create unique index if not exists book_loans_one_open_per_book
  on public.book_loans(book_id) where returned_at is null;

-- Single-row settings (per-student cap + default loan length).
create table if not exists public.library_settings (
  id                    uuid primary key default gen_random_uuid(),
  max_books_per_student int not null default 3,
  loan_days             int not null default 14,
  updated_at            timestamptz not null default now()
);
insert into public.library_settings (max_books_per_student, loan_days)
select 3, 14 where not exists (select 1 from public.library_settings);

-- ---------------------------------------------------------------------------
-- Grants + permissive RLS (access is gated in the app, like the other tables).
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

do $$
declare
  t text;
  open_tables text[] := array['books', 'book_loans', 'library_settings'];
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
