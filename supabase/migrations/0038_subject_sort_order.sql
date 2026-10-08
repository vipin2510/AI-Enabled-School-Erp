-- Subjects can now carry an explicit display order, controlled from the
-- Subjects screen (up/down arrows). Until now the Results cards, marks-entry
-- screens and the Subjects admin listed subjects alphabetically (`order by
-- name`); the school wants them in a fixed per-class order matching the
-- printed marksheet (English-I, English-II, Hindi, … then class-specific).
--
-- Model it as a plain integer `sort_order`; the app orders by (sort_order,
-- name) everywhere subjects are listed, so name stays the tiebreaker.

-- NOTE: subjects lives in the `erp` schema on the live DB (created in public in
-- 0005 but served from erp — see erp.* references from 0029 on).
alter table erp.subjects
  add column if not exists sort_order integer not null default 0;

-- Seed a stable, editable order from the current alphabetical listing, per
-- class, so existing subjects keep a sensible initial order until reordered.
update erp.subjects s
set sort_order = r.rn
from (
  select id, (row_number() over (partition by class_id order by name) - 1) as rn
  from erp.subjects
) r
where r.id = s.id;

-- PostgREST caches the schema; reload so the new column is queryable.
notify pgrst, 'reload schema';
