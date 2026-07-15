-- 0029_signatures_and_class_teachers.sql
-- Digital signatures + class-teacher assignment.
--
-- Two new tables in the `erp` schema (the live DB serves ERP tables from `erp`,
-- not `public` — see the schema note in project memory):
--   * erp.class_teachers      — per school+class+section: who the class teacher
--     is (a profile, chosen from the user dropdown) and their signature image.
--     Empty is allowed everywhere (teacher_id / signature_url nullable).
--   * erp.school_pdf_settings — per school: the principal's signature image, and
--     the configurable receipt / ID-card fonts (used by a later feature).
--
-- Apply manually (Supabase SQL editor or MCP), like every migration in this repo.

-- ---------------------------------------------------------------------------
-- class_teachers
-- ---------------------------------------------------------------------------
create table if not exists erp.class_teachers (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references erp.schools(id)  on delete cascade,
  class_id      uuid not null references erp.classes(id)  on delete cascade,
  section       text not null default '',                 -- '' when the class has no sections
  teacher_id    uuid references erp.profiles(id) on delete set null,  -- from the user dropdown; nullable
  signature_url text,                                      -- public URL in the `signatures` bucket; nullable
  updated_at    timestamptz not null default now(),
  unique (school_id, class_id, section)
);

create index if not exists class_teachers_school_idx  on erp.class_teachers(school_id);
create index if not exists class_teachers_teacher_idx on erp.class_teachers(teacher_id);

-- ---------------------------------------------------------------------------
-- school_pdf_settings  (principal signature + document fonts, one row/school)
-- ---------------------------------------------------------------------------
create table if not exists erp.school_pdf_settings (
  id                      uuid primary key default gen_random_uuid(),
  school_id               uuid not null references erp.schools(id) on delete cascade,
  principal_id            uuid references erp.profiles(id) on delete set null,
  principal_signature_url text,
  receipt_font_family     text    not null default 'Helvetica',
  receipt_font_scale      numeric(4,2) not null default 1.0,
  id_card_font_family     text    not null default 'Helvetica',
  id_card_font_scale      numeric(4,2) not null default 1.0,
  updated_at              timestamptz not null default now(),
  unique (school_id)
);

-- ---------------------------------------------------------------------------
-- Storage bucket for signature images (public read; writes go through the
-- service-role client which bypasses RLS, same as student-photos).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('signatures', 'signatures', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- GRANTs + permissive RLS (matches the anon_all_* convention in 0003/0023).
-- Authorization is enforced in the app layer, not the DB.
-- ---------------------------------------------------------------------------
grant all on erp.class_teachers       to anon, authenticated, service_role;
grant all on erp.school_pdf_settings  to anon, authenticated, service_role;

alter table erp.class_teachers      enable row level security;
alter table erp.school_pdf_settings enable row level security;

drop policy if exists anon_all_class_teachers on erp.class_teachers;
create policy anon_all_class_teachers on erp.class_teachers
  for all to anon, authenticated using (true) with check (true);

drop policy if exists anon_all_school_pdf_settings on erp.school_pdf_settings;
create policy anon_all_school_pdf_settings on erp.school_pdf_settings
  for all to anon, authenticated using (true) with check (true);

-- Make PostgREST pick up the new tables immediately.
notify pgrst, 'reload schema';
