-- Add father's and mother's mobile numbers to students.
-- Stored as text (not numeric) so we can keep leading zeros and any future
-- formatting the school may adopt. Validation (10 digits) is enforced in the
-- app layer via the student form action.
alter table public.students
  add column if not exists father_mobile text,
  add column if not exists mother_mobile text;
