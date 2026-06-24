-- Result card templates — JSON-defined layouts the admin can edit in a
-- Canva-style editor. Picked template renders student report cards from
-- the existing /api/results/zip pipeline.
--
-- Templates are GLOBAL across schools — one set shared by every branch.
-- A single row carries `is_default = true`; a partial unique index keeps
-- exactly one default at any time.

create table if not exists public.result_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  page_size   text not null default 'a4-portrait'
              check (page_size in ('a4-portrait','a4-landscape')),
  is_default  boolean not null default false,
  -- Block list — see TypeScript Block schema in
  -- src/lib/result-template.ts. Validated at the action layer.
  layout      jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists result_templates_name_uniq
  on public.result_templates (lower(name));

-- At most one default at a time.
create unique index if not exists result_templates_one_default
  on public.result_templates (is_default)
  where is_default = true;

-- Touch updated_at on every write. Mirrors the pattern from earlier migs.
create or replace function public.result_templates_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_result_templates_touch on public.result_templates;
create trigger trg_result_templates_touch
  before update on public.result_templates
  for each row execute function public.result_templates_touch_updated_at();

alter table public.result_templates enable row level security;
drop policy if exists anon_all_result_templates on public.result_templates;
create policy anon_all_result_templates
  on public.result_templates
  for all using (true) with check (true);

grant all on public.result_templates to anon, authenticated, service_role;

-- Seed two starter templates only on a first migration where the table
-- is empty — re-runs of this file are no-ops so edits to a school's
-- saved templates aren't clobbered.
insert into public.result_templates (name, description, page_size, is_default, layout)
select * from (values
  (
    'Standard Portrait',
    'Detailed portrait card — school header, marks table, summary boxes, signatures.',
    'a4-portrait',
    true,
    -- Mirrors the current hardcoded ResultCardPdf layout. The renderer
    -- accepts an empty `layout` array as a signal to use the hardcoded
    -- template as the fallback, so we keep this minimal here and the
    -- editor will populate it on first edit.
    '[]'::jsonb
  ),
  (
    'Compact Tabular (Landscape)',
    'Landscape grid card — subjects as rows, UT / Terminal / Aggregate columns with Max, Marks and Grade per stage.',
    'a4-landscape',
    false,
    '[]'::jsonb
  )
) as v(name, description, page_size, is_default, layout)
where not exists (select 1 from public.result_templates);
