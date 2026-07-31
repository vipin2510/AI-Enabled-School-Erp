-- Transfer Certificates.
--
-- A TC is raised for a student, the "no dues" position is reviewed, then it is
-- issued (admin). Issuing assigns the TC number and freezes the student
-- (students.status → 'inactive') so no new fees can be collected; history stays
-- intact. Most register fields (caste, conduct, dates, last exam, school days)
-- are captured on the issue form since they aren't on the students row.
--
-- The TC number is assigned ONLY when the row becomes 'issued' (so pending
-- requests don't burn numbers), via a trigger mirroring set_receipt_no().
--
-- Permissive RLS to match the app; gating is in the server actions
-- (leader-only to view, admin to issue). Apply manually — see CLAUDE.md.

create sequence if not exists erp.tc_seq;

create table if not exists erp.transfer_certificates (
  id                  uuid primary key default gen_random_uuid(),
  school_id           uuid not null references erp.schools(id) on delete cascade,
  student_id          uuid not null references erp.students(id) on delete cascade,
  academic_year       text not null,
  tc_no               text,
  status              text not null default 'requested'
                      check (status in ('requested', 'issued', 'cancelled')),
  -- Snapshot of student identity at issue time (student row may change later).
  admission_no        text,
  student_name        text,
  father_name         text,
  mother_name         text,
  date_of_birth       date,
  -- Register fields captured on the issue form.
  caste               text,
  admission_date      date,
  date_of_leaving     date,
  school_days_attended text,
  studying_class      text,               -- class the student was studying in
  last_exam_class     text,
  last_exam_year      text,
  last_exam_result    text,               -- passed / failed / promoted
  promoted_to_class   text,               -- "is enrolled in class …"
  admitted_in         text,               -- "He/She was admitted in …"
  conduct             text default 'Good',
  reason              text,               -- reason for leaving
  remarks             text,
  no_dues_amount      numeric(12,2) default 0,
  requested_by        uuid references erp.profiles(id) on delete set null,
  requested_at        timestamptz not null default now(),
  issued_by           text,
  issued_on           date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists transfer_certificates_school_idx  on erp.transfer_certificates (school_id, status);
create index if not exists transfer_certificates_student_idx on erp.transfer_certificates (student_id);

-- Assign the TC number the moment the row is issued (INSERT or UPDATE), never
-- for a pending request. Format: APS/TC/<ay>/<4-digit sequence>.
CREATE OR REPLACE FUNCTION erp.set_tc_no()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if new.status = 'issued' and (new.tc_no is null or new.tc_no = '') then
    new.tc_no := 'APS/TC/' || new.academic_year || '/' ||
                 lpad(nextval('erp.tc_seq')::text, 4, '0');
    if new.issued_on is null then new.issued_on := (now() at time zone 'Asia/Kolkata')::date; end if;
  end if;
  new.updated_at := now();
  return new;
end$function$;

drop trigger if exists set_tc_no_trg on erp.transfer_certificates;
create trigger set_tc_no_trg before insert or update on erp.transfer_certificates
  for each row execute function erp.set_tc_no();

grant all on erp.transfer_certificates to anon, authenticated, service_role;
alter table erp.transfer_certificates enable row level security;
drop policy if exists anon_all_transfer_certificates on erp.transfer_certificates;
create policy anon_all_transfer_certificates on erp.transfer_certificates for all using (true) with check (true);

notify pgrst, 'reload schema';
