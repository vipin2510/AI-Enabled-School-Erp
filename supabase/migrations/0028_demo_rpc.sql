
create or replace function public.clone_demo_school(
  p_school_id uuid,
  p_code text,
  p_academic_year text
) returns void
language plpgsql
as $$
declare
  template_id constant uuid := '00000000-0000-0000-0000-0000000000d0';
  demo_group  constant uuid := '10000000-0000-0000-0000-0000000000de';
begin
  insert into public.schools (id, group_id, code, name, location, board, board_code, is_active, sort_order)
  values (p_school_id, demo_group, p_code, 'Demo Public School', 'Demo City, India', 'Demo Board', 'DEMO', true, 99);

  insert into public.classes (id, school_id, code, display_name, ordinal, stream, group_label)
  select md5(c.id::text || p_school_id::text)::uuid, p_school_id, c.code, c.display_name, c.ordinal, c.stream, c.group_label
  from public.classes c where c.school_id = template_id;

  insert into public.sections (id, class_id, school_id, name)
  select gen_random_uuid(), md5(s.class_id::text || p_school_id::text)::uuid, p_school_id, s.name
  from public.sections s where s.school_id = template_id;

  insert into public.subjects (id, class_id, school_id, name)
  select gen_random_uuid(), md5(s.class_id::text || p_school_id::text)::uuid, p_school_id, s.name
  from public.subjects s where s.school_id = template_id;

  insert into public.fee_structures (id, school_id, academic_year, scope, class_id, group_label, student_kind, total_amount)
  select md5(fs.id::text || p_school_id::text)::uuid, p_school_id, p_academic_year, fs.scope,
         case when fs.class_id is null then null else md5(fs.class_id::text || p_school_id::text)::uuid end,
         fs.group_label, fs.student_kind, fs.total_amount
  from public.fee_structures fs where fs.school_id = template_id;

  insert into public.fee_structure_components
    (id, structure_id, school_id, kind, label, period_index, amount, due_date, is_refundable, is_one_time, sort_order)
  select gen_random_uuid(), md5(fc.structure_id::text || p_school_id::text)::uuid, p_school_id,
         fc.kind, fc.label, fc.period_index, fc.amount, fc.due_date, fc.is_refundable, fc.is_one_time, fc.sort_order
  from public.fee_structure_components fc where fc.school_id = template_id;


  insert into public.late_fee_settings (id, school_id, per_day_amount, grace_days, is_enabled)
  select gen_random_uuid(), p_school_id, l.per_day_amount, l.grace_days, l.is_enabled
  from public.late_fee_settings l where l.school_id = template_id;

  insert into public.students
    (id, school_id, full_name, class_id, section, gender, blood_group, date_of_birth,
     father_name, mother_name, contact_number, alt_contact, address,
     is_hosteller, is_new_admission, bus_fee_amount, status)
  select gen_random_uuid(), p_school_id, st.full_name,
         case when st.class_id is null then null else md5(st.class_id::text || p_school_id::text)::uuid end,
         st.section, st.gender, st.blood_group, st.date_of_birth,
         st.father_name, st.mother_name, st.contact_number, st.alt_contact, st.address,
         st.is_hosteller, st.is_new_admission, st.bus_fee_amount, st.status
  from public.students st where st.school_id = template_id;
end;
$$;

create or replace function public.teardown_demo_school(p_school_id uuid)
returns void
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.schools
    where id = p_school_id
      and group_id = '10000000-0000-0000-0000-0000000000de'
      and id <> '00000000-0000-0000-0000-0000000000d0'
  ) then
    return;
  end if;

  delete from public.payments                 where school_id = p_school_id;
  delete from public.invoice_items            where school_id = p_school_id;
  delete from public.invoices                 where school_id = p_school_id;
  delete from public.attendance               where school_id = p_school_id;
  delete from public.marks                    where school_id = p_school_id;
  delete from public.co_curricular_grades     where school_id = p_school_id;
  delete from public.book_loans               where school_id = p_school_id;
  delete from public.book_requests            where school_id = p_school_id;
  delete from public.books                    where school_id = p_school_id;
  delete from public.library_settings         where school_id = p_school_id;
  delete from public.staff_attendance         where school_id = p_school_id;
  delete from public.change_requests          where school_id = p_school_id;
  delete from public.fee_structure_components where school_id = p_school_id;
  delete from public.fee_structures           where school_id = p_school_id;
  delete from public.students                 where school_id = p_school_id;
  delete from public.subjects                 where school_id = p_school_id;
  delete from public.sections                 where school_id = p_school_id;
  delete from public.late_fee_settings        where school_id = p_school_id;
  delete from public.classes                  where school_id = p_school_id;
  delete from public.schools                  where id = p_school_id;
end;
$$;

grant execute on function public.clone_demo_school(uuid, text, text) to anon, authenticated;
grant execute on function public.teardown_demo_school(uuid) to anon, authenticated;
