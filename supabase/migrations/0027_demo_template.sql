
begin;

insert into public.groups (id, code, name, short_name, logo_path, location, domain, sort_order)
values ('10000000-0000-0000-0000-0000000000de', 'demo', 'Demo Public School',
        'Demo', '/branding/aadeshwar/logo.jpeg', 'Demo City, India', null, 99)
on conflict (id) do nothing;

insert into public.schools (id, code, name, location, board, board_code, is_active, sort_order, group_id)
values ('00000000-0000-0000-0000-0000000000d0', 'demo-template', 'Demo Public School',
        'Demo City, India', 'Demo Board', 'DEMO', true, 99,
        '10000000-0000-0000-0000-0000000000de')
on conflict (id) do nothing;

delete from public.fee_structure_components where school_id = '00000000-0000-0000-0000-0000000000d0';
delete from public.fee_structures           where school_id = '00000000-0000-0000-0000-0000000000d0';
delete from public.students                  where school_id = '00000000-0000-0000-0000-0000000000d0';
delete from public.subjects                  where school_id = '00000000-0000-0000-0000-0000000000d0';
delete from public.sections                  where school_id = '00000000-0000-0000-0000-0000000000d0';
delete from public.late_fee_settings         where school_id = '00000000-0000-0000-0000-0000000000d0';
delete from public.classes                   where school_id = '00000000-0000-0000-0000-0000000000d0';

insert into public.classes (id, school_id, code, display_name, ordinal) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d0', 'NUR', 'Nursery', 1),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000d0', 'KG',  'KG',      2),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000d0', '1ST', '1st',     3),
  ('00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-0000000000d0', '2ND', '2nd',     4),
  ('00000000-0000-0000-0000-0000000000c5', '00000000-0000-0000-0000-0000000000d0', '3RD', '3rd',     5),
  ('00000000-0000-0000-0000-0000000000c6', '00000000-0000-0000-0000-0000000000d0', '4TH', '4th',     6);

insert into public.sections (id, class_id, school_id, name)
select gen_random_uuid(), c.id, '00000000-0000-0000-0000-0000000000d0', s.name
from public.classes c
cross join (values ('A'), ('B')) as s(name)
where c.school_id = '00000000-0000-0000-0000-0000000000d0';

insert into public.subjects (id, class_id, school_id, name)
select gen_random_uuid(), c.id, '00000000-0000-0000-0000-0000000000d0', s.name
from public.classes c
cross join (values ('English'), ('Hindi'), ('Mathematics')) as s(name)
where c.school_id = '00000000-0000-0000-0000-0000000000d0';

insert into public.late_fee_settings (id, school_id, per_day_amount, grace_days, is_enabled)
values (gen_random_uuid(), '00000000-0000-0000-0000-0000000000d0', 50, 5, true);

insert into public.fee_structures (id, school_id, academic_year, scope, class_id, student_kind, total_amount) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000d0', '2026-27', 'school', '00000000-0000-0000-0000-0000000000c1', 'any', 19400),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000d0', '2026-27', 'school', '00000000-0000-0000-0000-0000000000c2', 'any', 20600),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000d0', '2026-27', 'school', '00000000-0000-0000-0000-0000000000c3', 'any', 23000),
  ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-0000000000d0', '2026-27', 'school', '00000000-0000-0000-0000-0000000000c4', 'any', 24200),
  ('00000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-0000000000d0', '2026-27', 'school', '00000000-0000-0000-0000-0000000000c5', 'any', 25400),
  ('00000000-0000-0000-0000-0000000000f6', '00000000-0000-0000-0000-0000000000d0', '2026-27', 'school', '00000000-0000-0000-0000-0000000000c6', 'any', 26600);

insert into public.fee_structure_components
  (id, structure_id, school_id, kind, label, period_index, amount, is_one_time, sort_order)
select gen_random_uuid(), s.id, '00000000-0000-0000-0000-0000000000d0',
       'admission_one_time', 'Admission Fee', null, s.admission, true, 0
from (values
  ('00000000-0000-0000-0000-0000000000f1'::uuid, 5000::numeric),
  ('00000000-0000-0000-0000-0000000000f2'::uuid, 5000),
  ('00000000-0000-0000-0000-0000000000f3'::uuid, 5000),
  ('00000000-0000-0000-0000-0000000000f4'::uuid, 5000),
  ('00000000-0000-0000-0000-0000000000f5'::uuid, 5000),
  ('00000000-0000-0000-0000-0000000000f6'::uuid, 5000)
) as s(id, admission);

insert into public.fee_structure_components
  (id, structure_id, school_id, kind, label, period_index, amount, is_one_time, sort_order)
select gen_random_uuid(), s.id, '00000000-0000-0000-0000-0000000000d0',
       'monthly', 'Tuition (month ' || m.idx || ')', m.idx, s.monthly, false, m.idx
from (values
  ('00000000-0000-0000-0000-0000000000f1'::uuid, 1200::numeric),
  ('00000000-0000-0000-0000-0000000000f2'::uuid, 1300),
  ('00000000-0000-0000-0000-0000000000f3'::uuid, 1500),
  ('00000000-0000-0000-0000-0000000000f4'::uuid, 1600),
  ('00000000-0000-0000-0000-0000000000f5'::uuid, 1700),
  ('00000000-0000-0000-0000-0000000000f6'::uuid, 1800)
) as s(id, monthly)
cross join generate_series(1, 12) as m(idx);

insert into public.students
  (id, school_id, full_name, class_id, section, gender, father_name, mother_name, contact_number, status)
select gen_random_uuid(), '00000000-0000-0000-0000-0000000000d0',
       d.full_name, d.class_id::uuid, d.section, d.gender, d.father, d.mother, d.phone, 'active'
from (values
  ('Aarav Sharma',   '00000000-0000-0000-0000-0000000000c1', 'A', 'M', 'Rakesh Sharma',   'Sunita Sharma',   '9000000001'),
  ('Diya Verma',     '00000000-0000-0000-0000-0000000000c1', 'B', 'F', 'Anil Verma',      'Priya Verma',     '9000000002'),
  ('Vivaan Gupta',   '00000000-0000-0000-0000-0000000000c2', 'A', 'M', 'Manoj Gupta',     'Kavita Gupta',    '9000000003'),
  ('Ananya Singh',   '00000000-0000-0000-0000-0000000000c2', 'B', 'F', 'Rajan Singh',     'Meena Singh',     '9000000004'),
  ('Aditya Patel',   '00000000-0000-0000-0000-0000000000c3', 'A', 'M', 'Suresh Patel',    'Nisha Patel',     '9000000005'),
  ('Ishaan Yadav',   '00000000-0000-0000-0000-0000000000c3', 'B', 'M', 'Dinesh Yadav',    'Rekha Yadav',     '9000000006'),
  ('Saanvi Mishra',  '00000000-0000-0000-0000-0000000000c3', 'A', 'F', 'Alok Mishra',     'Pooja Mishra',    '9000000007'),
  ('Reyansh Jain',   '00000000-0000-0000-0000-0000000000c4', 'A', 'M', 'Vikas Jain',      'Sneha Jain',      '9000000008'),
  ('Myra Tiwari',    '00000000-0000-0000-0000-0000000000c4', 'B', 'F', 'Sanjay Tiwari',   'Anjali Tiwari',   '9000000009'),
  ('Kabir Sahu',     '00000000-0000-0000-0000-0000000000c5', 'A', 'M', 'Ramesh Sahu',     'Geeta Sahu',      '9000000010'),
  ('Aadhya Nair',    '00000000-0000-0000-0000-0000000000c5', 'B', 'F', 'Mahesh Nair',     'Lata Nair',       '9000000011'),
  ('Arjun Reddy',    '00000000-0000-0000-0000-0000000000c5', 'A', 'M', 'Naveen Reddy',    'Swati Reddy',     '9000000012'),
  ('Kiara Das',      '00000000-0000-0000-0000-0000000000c6', 'A', 'F', 'Subrata Das',     'Mou Das',         '9000000013'),
  ('Aryan Khan',     '00000000-0000-0000-0000-0000000000c6', 'B', 'M', 'Imran Khan',      'Sana Khan',       '9000000014'),
  ('Riya Joshi',     '00000000-0000-0000-0000-0000000000c6', 'A', 'F', 'Prakash Joshi',   'Hema Joshi',      '9000000015')
) as d(full_name, class_id, section, gender, father, mother, phone);

commit;
