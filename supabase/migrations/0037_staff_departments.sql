-- Staff (Layer 3) can now belong to more than one department on a single login.
--
-- Until now a staff profile carried exactly one `department` (a single text
-- column). The requirement is that one Layer-3 account can cover e.g. Fees AND
-- Library. Model it like `school_ids`: an array of departments.
--
-- We KEEP the singular `department` column and treat it as the "primary"
-- department (= departments[0]). Every existing read/PDF/display that selects
-- `department` keeps working untouched; the new array only drives access
-- (which departments a staff may open/switch between). The app writes both in
-- lockstep (see src/app/admin/users/actions.ts).

-- NOTE: profiles lives in the `erp` schema on the live DB (it was created in
-- public in 0005 but moved to erp — see erp.profiles references from 0029 on).
alter table erp.profiles
  add column if not exists departments text[] not null default '{}';

-- Backfill: seed the array from the existing single department for staff rows.
update erp.profiles
  set departments = array[department]
  where department is not null
    and (departments is null or departments = '{}');

-- PostgREST caches the schema; reload so the new column is queryable.
notify pgrst, 'reload schema';
