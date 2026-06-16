-- Make classes.code unique per school instead of globally. The original
-- migration 0001 declared `code text not null unique` when there was a single
-- school, so a second school can't seed its own "1ST"/"11_SCI" etc. without
-- colliding. Existing data was all backfilled to Kondagaon in 0011 so this
-- swap is safe — every current code lives on a single school.

alter table public.classes
  drop constraint if exists classes_code_key;

create unique index if not exists classes_school_code_uniq
  on public.classes (school_id, code);
