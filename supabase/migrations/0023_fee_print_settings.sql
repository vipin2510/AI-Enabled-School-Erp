-- Per-school fee-receipt print layout. Controls how the receipt PDF lays
-- copies out on a sheet: page orientation plus the exact size of each copy
-- box (width/height in mm), the page margin, the gap between boxes left for
-- cutting, and a binding gutter on the School Copy for hole-punching. The
-- renderer tiles as many boxes as fit and cycles the copy types (School /
-- Student) to fill them. Read by /api/receipts/[id]/pdf; edited from
-- Fees ▸ Settings ▸ Print Layout (admin/manager only).
--
-- Sizes are in millimetres so they map directly onto A4 (210 × 297 mm).
--
-- Permissive RLS to match the rest of the app — gating happens in the
-- settings page/action via requireRole("admin","manager").

create table if not exists public.fee_print_settings (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references public.schools(id) on delete cascade,
  orientation     text not null default 'portrait'
                  check (orientation in ('portrait', 'landscape')),
  -- Size of one receipt-copy box, in millimetres. Defaults reproduce the
  -- historic half-A4 stacked copy (full width × half height of A4).
  box_width_mm    numeric(6,1) not null default 198,
  box_height_mm   numeric(6,1) not null default 140,
  -- Blank page border (all four sides) and the cut gap between boxes.
  page_margin_mm  numeric(5,1) not null default 6,
  box_gap_mm      numeric(5,1) not null default 0,
  -- Extra blank gutter on the left edge of the School Copy only, so the filed
  -- copy can be hole-punched without piercing printed content.
  school_binding_mm numeric(5,1) not null default 0,
  updated_at      timestamptz not null default now(),
  unique (school_id)
);

-- Additive guards: an earlier draft of this migration created the table with
-- a `copies_per_page` column instead of explicit sizes. These bring such a
-- table up to the final schema (and are no-ops on a fresh create above), so
-- the migration is safe to re-run regardless of which version ran first.
alter table public.fee_print_settings add column if not exists box_width_mm      numeric(6,1) not null default 198;
alter table public.fee_print_settings add column if not exists box_height_mm     numeric(6,1) not null default 140;
alter table public.fee_print_settings add column if not exists page_margin_mm    numeric(5,1) not null default 6;
alter table public.fee_print_settings add column if not exists box_gap_mm        numeric(5,1) not null default 0;
alter table public.fee_print_settings add column if not exists school_binding_mm numeric(5,1) not null default 0;
alter table public.fee_print_settings drop column if exists copies_per_page;

alter table public.fee_print_settings enable row level security;
drop policy if exists anon_all_fee_print_settings on public.fee_print_settings;
create policy anon_all_fee_print_settings on public.fee_print_settings for all using (true) with check (true);

grant all on public.fee_print_settings to anon, authenticated, service_role;
