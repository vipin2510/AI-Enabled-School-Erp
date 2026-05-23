-- Seed classes + fee structures for AY 2026-27 from FEES 2026-27.xlsx
-- Idempotent: uses upsert keys.

-- ---------- Classes ----------
insert into public.classes (code, display_name, ordinal, stream, group_label) values
  ('PLAY',   'Play Group', 1,  null, null),
  ('NUR',    'Nursery',    2,  null, null),
  ('LKG',    'L.K.G.',     3,  null, null),
  ('UKG',    'U.K.G.',     4,  null, null),
  ('1ST',    '1st',        5,  null, 'I TO III'),
  ('2ND',    '2nd',        6,  null, 'I TO III'),
  ('3RD',    '3rd',        7,  null, 'I TO III'),
  ('4TH',    '4th',        8,  null, 'IV TO V'),
  ('5TH',    '5th',        9,  null, 'IV TO V'),
  ('6TH',    '6th',        10, null, 'VI TO VIII'),
  ('7TH',    '7th',        11, null, 'VI TO VIII'),
  ('8TH',    '8th',        12, null, 'VI TO VIII'),
  ('9TH',    '9th',        13, null, 'IX & X'),
  ('10TH',   '10th',       14, null, 'IX & X'),
  ('11_SCI', '11th (Sci)', 15, 'Sci', 'XI & XII'),
  ('12_SCI', '12th (Sci)', 16, 'Sci', 'XI & XII'),
  ('11_COM', '11th (Com)', 17, 'Com', 'XI & XII'),
  ('12_COM', '12th (Com)', 18, 'Com', 'XI & XII')
on conflict (code) do update
  set display_name = excluded.display_name,
      ordinal      = excluded.ordinal,
      stream       = excluded.stream,
      group_label  = excluded.group_label;

-- ---------- School fee structures (per class) ----------
-- Columns: REG.FEE, YEARLY FEE, NEW ADMISSION, MONTHLY FEE, CAUTION MONEY
-- A "yearly" component is the annual book / dev fee billed once.
-- "monthly" is split into 12 month components (Apr..Mar). Period index = calendar month.
-- "admission_one_time" applies to new admissions only.

-- We use a helper to create a school structure + components in one shot.
-- Postgres anonymous DO block for clarity.

do $$
declare
  v_year text := '2026-27';
  v_struct uuid;
  v_class_id uuid;
  r record;
  m int;
  start_month int := 4; -- Apr-start session
  month_names text[] := array['January','February','March','April','May','June',
                              'July','August','September','October','November','December'];
begin
  for r in
    select * from (values
      ('PLAY',   500::numeric, 3000::numeric,  4670::numeric, 1370::numeric, 0::numeric),
      ('NUR',    500,          3000,           4670,          1820,          0),
      ('LKG',    500,          3000,           4674,          1910,          0),
      ('UKG',    500,          3000,           4670,          1910,          0),
      ('1ST',    500,          3500,           5279,          2210,          0),
      ('2ND',    500,          3500,           5275,          2210,          0),
      ('3RD',    500,          3500,           5275,          2210,          0),
      ('4TH',    500,          3500,           5275,          2470,          0),
      ('5TH',    500,          3500,           5275,          2470,          0),
      ('6TH',    500,          4500,           5275,          2760,          0),
      ('7TH',    500,          4500,           5275,          2760,          0),
      ('8TH',    500,          4500,           5275,          2760,          0),
      ('9TH',    500,          4500,           6595,          3360,          3000),
      ('10TH',   500,          4500,           6595,          3360,          3000),
      ('11_SCI', 500,          5000,           6595,          4700,          5000),
      ('12_SCI', 500,          5000,           6595,          4700,          5000),
      ('11_COM', 500,          5000,           6595,          4234,          4000),
      ('12_COM', 500,          5000,           6595,          4234,          4000)
    ) as t(code, reg_fee, yearly_fee, new_admission, monthly_fee, caution)
  loop
    select id into v_class_id from public.classes where code = r.code;

    insert into public.fee_structures (academic_year, scope, class_id, student_kind, total_amount)
    values (v_year, 'school', v_class_id, 'any', (r.yearly_fee + r.monthly_fee * 12))
    on conflict (academic_year, scope, class_id, group_label, student_kind)
      do update set total_amount = excluded.total_amount
    returning id into v_struct;

    -- Wipe old components for clean re-seed
    delete from public.fee_structure_components where structure_id = v_struct;

    insert into public.fee_structure_components
      (structure_id, kind, label, period_index, amount, due_date, is_refundable, is_one_time, sort_order)
    values
      (v_struct, 'registration',       'Registration Fee',  null, r.reg_fee,
        null, false, true, 0),
      (v_struct, 'admission_one_time', 'New Admission Fee', null, r.new_admission,
        null, false, true, 1),
      (v_struct, 'caution',            'Caution Money',     null, r.caution,
        null, true,  true, 2),
      (v_struct, 'yearly',             'Yearly Fee (Books/Dev)', null, r.yearly_fee,
        date_trunc('month', make_date(2026, 4, 1))::date + 9, false, true, 3);

    -- Monthly Apr 2026 → Mar 2027
    for m in 0..11 loop
      insert into public.fee_structure_components
        (structure_id, kind, label, period_index, amount, due_date, is_refundable, is_one_time, sort_order)
      values (
        v_struct,
        'monthly',
        'Monthly Fee — ' || month_names[((start_month + m - 1) % 12) + 1],
        ((start_month + m - 1) % 12) + 1,
        r.monthly_fee,
        (make_date(case when m + start_month - 1 < 12 then 2026 else 2027 end,
                   ((start_month + m - 1) % 12) + 1, 10)),
        false, false, 100 + m
      );
    end loop;
  end loop;
end$$;


-- ---------- Hostel fee structures (per group_label × new/old) ----------
do $$
declare
  v_year text := '2026-27';
  v_struct uuid;
  r record;
begin
  -- New students
  for r in
    select * from (values
      ('I TO III',     1000::numeric, 3000::numeric, 32430::numeric, 23160::numeric, 18520::numeric, 18520::numeric),
      ('IV TO V',      1000,          3000,          35940,          25670,          20540,          20540),
      ('VI TO VIII',   1000,          3000,          40650,          29040,          23230,          23230),
      ('IX & X',       1000,          3000,          49860,          35610,          28490,          28490),
      ('XI & XII',     1000,          3000,          58050,          41460,          33170,          33170)
    ) as t(grp, reg, caution, inst1, inst2, inst3, inst4)
  loop
    insert into public.fee_structures (academic_year, scope, class_id, group_label, student_kind, total_amount)
    values (v_year, 'hostel', null, r.grp, 'new', (r.inst1 + r.inst2 + r.inst3 + r.inst4))
    on conflict (academic_year, scope, class_id, group_label, student_kind)
      do update set total_amount = excluded.total_amount
    returning id into v_struct;

    delete from public.fee_structure_components where structure_id = v_struct;

    insert into public.fee_structure_components
      (structure_id, kind, label, period_index, amount, due_date, is_refundable, is_one_time, sort_order)
    values
      (v_struct, 'registration', 'Hostel Registration Fee', null, r.reg,    null, false, true, 0),
      (v_struct, 'caution',      'Hostel Caution Money',    null, r.caution, null, true,  true, 1),
      (v_struct, 'instalment',   '1st Instalment (At Admission)',     1, r.inst1, make_date(2026,4,15), false, false, 10),
      (v_struct, 'instalment',   '2nd Instalment (Before 15 Aug)',    2, r.inst2, make_date(2026,8,15), false, false, 11),
      (v_struct, 'instalment',   '3rd Instalment (Before 10 Sep)',    3, r.inst3, make_date(2026,9,10), false, false, 12),
      (v_struct, 'instalment',   '4th Instalment (Before 10 Jan)',    4, r.inst4, make_date(2027,1,10), false, false, 13);
  end loop;

  -- Old students
  for r in
    select * from (values
      ('I TO III',     29360::numeric, 20970::numeric, 16780::numeric, 16780::numeric),
      ('IV TO V',      32890,          23490,          18790,          18790),
      ('VI TO VIII',   37020,          26440,          21150,          21150),
      ('IX & X',       45150,          32250,          25800,          25800),
      ('XI & XII',     52830,          37730,          30190,          30190)
    ) as t(grp, inst1, inst2, inst3, inst4)
  loop
    insert into public.fee_structures (academic_year, scope, class_id, group_label, student_kind, total_amount)
    values (v_year, 'hostel', null, r.grp, 'old', (r.inst1 + r.inst2 + r.inst3 + r.inst4))
    on conflict (academic_year, scope, class_id, group_label, student_kind)
      do update set total_amount = excluded.total_amount
    returning id into v_struct;

    delete from public.fee_structure_components where structure_id = v_struct;

    insert into public.fee_structure_components
      (structure_id, kind, label, period_index, amount, due_date, is_refundable, is_one_time, sort_order)
    values
      (v_struct, 'instalment', '1st Instalment (At Admission)',  1, r.inst1, make_date(2026,4,15), false, false, 10),
      (v_struct, 'instalment', '2nd Instalment (Before 15 Aug)', 2, r.inst2, make_date(2026,8,15), false, false, 11),
      (v_struct, 'instalment', '3rd Instalment (Before 10 Sep)', 3, r.inst3, make_date(2026,9,10), false, false, 12),
      (v_struct, 'instalment', '4th Instalment (Before 10 Jan)', 4, r.inst4, make_date(2027,1,10), false, false, 13);
  end loop;
end$$;
