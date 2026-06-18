-- Student category buckets — independent of new/old admission. Drives
-- fee waiver policy on /fees/collect/[studentId]:
--   regular     → standard collection
--   rte         → no fee charged; every selected item auto-waived
--   staff_child → only monthly (tuition) is charged; the rest are waived
--
-- Defaulting all existing rows to 'regular' keeps current behavior.
alter table public.students
  add column if not exists category text not null default 'regular'
    check (category in ('regular', 'rte', 'staff_child'));

create index if not exists students_category_idx
  on public.students (category);
