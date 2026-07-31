-- =============================================================
-- Adeshwar ERP — full schema under a dedicated `erp` schema
-- Generated from the live public schema of the old project.
-- Run ONCE in the new project (vknemthgkkbseucxgmyc) SQL editor.
-- =============================================================
create schema if not exists erp;
grant usage on schema erp to anon, authenticated, service_role;
alter default privileges in schema erp grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema erp grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema erp grant all on functions to anon, authenticated, service_role;

-- standalone sequence used by set_receipt_no() (continue from old value 26)
create sequence if not exists erp.invoice_seq;
select setval('erp.invoice_seq', 26, true);

-- ---------- FUNCTIONS ----------
CREATE OR REPLACE FUNCTION erp.set_receipt_no()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if new.receipt_no is null then
    new.receipt_no := 'APS/' || new.academic_year || '/' ||
                      lpad(nextval('erp.invoice_seq')::text, 6, '0');
  end if;
  return new;
end$function$

;
CREATE OR REPLACE FUNCTION erp.touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at := now();
  return new;
end; $function$

;
CREATE OR REPLACE FUNCTION erp.result_templates_touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$

;
CREATE OR REPLACE FUNCTION erp.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'erp'
AS $function$
declare
  meta_school_ids uuid[];
  meta_group_id   uuid;
begin
  begin
    select coalesce(array_agg(value::text::uuid), '{}')
      into meta_school_ids
      from jsonb_array_elements_text(coalesce(new.raw_user_meta_data->'school_ids','[]'::jsonb)) as value;
  exception when others then
    meta_school_ids := '{}';
  end;

  begin
    meta_group_id := nullif(new.raw_user_meta_data->>'group_id','')::uuid;
  exception when others then
    meta_group_id := null;
  end;

  insert into erp.profiles (id, email, phone, full_name, role, department, school_ids, group_id)
  values (
    new.id,
    new.email,
    coalesce(new.phone, nullif(new.raw_user_meta_data->>'phone','')),
    coalesce(new.raw_user_meta_data->>'full_name',''),
    coalesce(nullif(new.raw_user_meta_data->>'role',''),'staff'),
    nullif(new.raw_user_meta_data->>'department',''),
    meta_school_ids,
    coalesce(meta_group_id, '10000000-0000-0000-0000-000000000001')
  )
  on conflict (id) do nothing;
  return new;
end;
$function$

;
CREATE OR REPLACE FUNCTION erp.clone_demo_school(p_school_id uuid, p_code text, p_academic_year text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  template_id constant uuid := '00000000-0000-0000-0000-0000000000d0';
  demo_group  constant uuid := '10000000-0000-0000-0000-0000000000de';
begin
  insert into erp.schools (id, group_id, code, name, location, board, board_code, is_active, sort_order)
  values (p_school_id, demo_group, p_code, 'Demo Public School', 'Demo City, India', 'Demo Board', 'DEMO', true, 99);

  insert into erp.classes (id, school_id, code, display_name, ordinal, stream, group_label)
  select md5(c.id::text || p_school_id::text)::uuid, p_school_id, c.code, c.display_name, c.ordinal, c.stream, c.group_label
  from erp.classes c where c.school_id = template_id;

  insert into erp.sections (id, class_id, school_id, name)
  select gen_random_uuid(), md5(s.class_id::text || p_school_id::text)::uuid, p_school_id, s.name
  from erp.sections s where s.school_id = template_id;

  insert into erp.subjects (id, class_id, school_id, name)
  select gen_random_uuid(), md5(s.class_id::text || p_school_id::text)::uuid, p_school_id, s.name
  from erp.subjects s where s.school_id = template_id;

  insert into erp.fee_structures (id, school_id, academic_year, scope, class_id, group_label, student_kind, total_amount)
  select md5(fs.id::text || p_school_id::text)::uuid, p_school_id, p_academic_year, fs.scope,
         case when fs.class_id is null then null else md5(fs.class_id::text || p_school_id::text)::uuid end,
         fs.group_label, fs.student_kind, fs.total_amount
  from erp.fee_structures fs where fs.school_id = template_id;

  insert into erp.fee_structure_components
    (id, structure_id, school_id, kind, label, period_index, amount, due_date, is_refundable, is_one_time, sort_order)
  select gen_random_uuid(), md5(fc.structure_id::text || p_school_id::text)::uuid, p_school_id,
         fc.kind, fc.label, fc.period_index, fc.amount, fc.due_date, fc.is_refundable, fc.is_one_time, fc.sort_order
  from erp.fee_structure_components fc where fc.school_id = template_id;


  insert into erp.late_fee_settings (id, school_id, per_day_amount, grace_days, is_enabled)
  select gen_random_uuid(), p_school_id, l.per_day_amount, l.grace_days, l.is_enabled
  from erp.late_fee_settings l where l.school_id = template_id;

  insert into erp.students
    (id, school_id, full_name, class_id, section, gender, blood_group, date_of_birth,
     father_name, mother_name, contact_number, alt_contact, address,
     is_hosteller, is_new_admission, bus_fee_amount, status)
  select gen_random_uuid(), p_school_id, st.full_name,
         case when st.class_id is null then null else md5(st.class_id::text || p_school_id::text)::uuid end,
         st.section, st.gender, st.blood_group, st.date_of_birth,
         st.father_name, st.mother_name, st.contact_number, st.alt_contact, st.address,
         st.is_hosteller, st.is_new_admission, st.bus_fee_amount, st.status
  from erp.students st where st.school_id = template_id;
end;
$function$

;
CREATE OR REPLACE FUNCTION erp.teardown_demo_school(p_school_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
begin
  if not exists (
    select 1 from erp.schools
    where id = p_school_id
      and group_id = '10000000-0000-0000-0000-0000000000de'
      and id <> '00000000-0000-0000-0000-0000000000d0'
  ) then
    return;
  end if;

  delete from erp.payments                 where school_id = p_school_id;
  delete from erp.invoice_items            where school_id = p_school_id;
  delete from erp.invoices                 where school_id = p_school_id;
  delete from erp.attendance               where school_id = p_school_id;
  delete from erp.marks                    where school_id = p_school_id;
  delete from erp.co_curricular_grades     where school_id = p_school_id;
  delete from erp.book_loans               where school_id = p_school_id;
  delete from erp.book_requests            where school_id = p_school_id;
  delete from erp.books                    where school_id = p_school_id;
  delete from erp.library_settings         where school_id = p_school_id;
  delete from erp.staff_attendance         where school_id = p_school_id;
  delete from erp.change_requests          where school_id = p_school_id;
  delete from erp.fee_structure_components where school_id = p_school_id;
  delete from erp.fee_structures           where school_id = p_school_id;
  delete from erp.students                 where school_id = p_school_id;
  delete from erp.subjects                 where school_id = p_school_id;
  delete from erp.sections                 where school_id = p_school_id;
  delete from erp.late_fee_settings        where school_id = p_school_id;
  delete from erp.classes                  where school_id = p_school_id;
  delete from erp.schools                  where id = p_school_id;
end;
$function$

;

-- ---------- TABLES / INDEXES / CONSTRAINTS / TRIGGERS / RLS ----------
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.10 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: attendance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE erp.attendance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    class_id uuid,
    section text,
    date date NOT NULL,
    status text DEFAULT 'present'::text NOT NULL,
    marked_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    school_id uuid NOT NULL,
    CONSTRAINT attendance_status_check CHECK ((status = ANY (ARRAY['present'::text, 'absent'::text])))
);


--
-- Name: book_loans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE erp.book_loans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    book_id uuid NOT NULL,
    student_id uuid NOT NULL,
    issued_at timestamp with time zone DEFAULT now() NOT NULL,
    due_date date,
    returned_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    school_id uuid NOT NULL
);


--
-- Name: book_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE erp.book_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    author text,
    requested_for text,
    note text,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    fulfilled_at timestamp with time zone,
    school_id uuid NOT NULL,
    CONSTRAINT book_requests_status_check CHECK ((status = ANY (ARRAY['open'::text, 'fulfilled'::text])))
);


--
-- Name: books; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE erp.books (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    title text NOT NULL,
    author text,
    isbn text,
    category text,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    school_id uuid NOT NULL,
    CONSTRAINT books_status_check CHECK ((status = ANY (ARRAY['active'::text, 'lost'::text, 'withdrawn'::text])))
);


--
-- Name: change_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE erp.change_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    requested_by uuid,
    requester_email text,
    subject text NOT NULL,
    body text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    admin_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    school_id uuid NOT NULL,
    CONSTRAINT change_requests_status_check CHECK ((status = ANY (ARRAY['open'::text, 'resolved'::text])))
);


--
-- Name: classes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE erp.classes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    display_name text NOT NULL,
    ordinal integer NOT NULL,
    stream text,
    group_label text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    school_id uuid NOT NULL
);


--
-- Name: co_curricular_grades; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE erp.co_curricular_grades (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    subject_id uuid NOT NULL,
    academic_year text NOT NULL,
    grade text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    school_id uuid NOT NULL,
    CONSTRAINT co_curricular_grades_grade_check CHECK ((grade = ANY (ARRAY['A'::text, 'B'::text, 'C'::text, 'D'::text, 'E'::text])))
);


--
-- Name: fee_print_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE erp.fee_print_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    orientation text DEFAULT 'portrait'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    box_width_mm numeric(6,1) DEFAULT 198 NOT NULL,
    box_height_mm numeric(6,1) DEFAULT 140 NOT NULL,
    page_margin_mm numeric(5,1) DEFAULT 6 NOT NULL,
    box_gap_mm numeric(5,1) DEFAULT 0 NOT NULL,
    school_binding_mm numeric(5,1) DEFAULT 0 NOT NULL,
    CONSTRAINT fee_print_settings_orientation_check CHECK ((orientation = ANY (ARRAY['portrait'::text, 'landscape'::text])))
);


--
-- Name: fee_structure_components; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE erp.fee_structure_components (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    structure_id uuid NOT NULL,
    kind text NOT NULL,
    label text NOT NULL,
    period_index integer,
    amount numeric(12,2) NOT NULL,
    due_date date,
    is_refundable boolean DEFAULT false NOT NULL,
    is_one_time boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    school_id uuid NOT NULL,
    CONSTRAINT fee_structure_components_kind_check CHECK ((kind = ANY (ARRAY['registration'::text, 'caution'::text, 'admission_one_time'::text, 'yearly'::text, 'monthly'::text, 'quarterly'::text, 'instalment'::text])))
);


--
-- Name: fee_structures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE erp.fee_structures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    academic_year text NOT NULL,
    scope text NOT NULL,
    class_id uuid,
    group_label text,
    student_kind text DEFAULT 'any'::text NOT NULL,
    total_amount numeric(12,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    school_id uuid NOT NULL,
    CONSTRAINT fee_structures_scope_check CHECK ((scope = ANY (ARRAY['school'::text, 'hostel'::text]))),
    CONSTRAINT fee_structures_student_kind_check CHECK ((student_kind = ANY (ARRAY['new'::text, 'old'::text, 'any'::text])))
);


--
-- Name: groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE erp.groups (
    id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    short_name text,
    logo_path text,
    location text,
    domain text,
    accent text,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: invoice_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE erp.invoice_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    component_id uuid,
    description text NOT NULL,
    kind text NOT NULL,
    period_index integer,
    amount numeric(12,2) NOT NULL,
    waived boolean DEFAULT false NOT NULL,
    waiver_reason text,
    school_id uuid NOT NULL
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE erp.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    receipt_no text,
    student_id uuid NOT NULL,
    academic_year text NOT NULL,
    issued_at timestamp with time zone DEFAULT now() NOT NULL,
    subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    late_fee numeric(12,2) DEFAULT 0 NOT NULL,
    waiver_amount numeric(12,2) DEFAULT 0 NOT NULL,
    total numeric(12,2) DEFAULT 0 NOT NULL,
    amount_paid numeric(12,2) DEFAULT 0 NOT NULL,
    balance numeric(12,2) DEFAULT 0 NOT NULL,
    payment_status text DEFAULT 'pending'::text NOT NULL,
    payment_mode text,
    payment_ref text,
    waiver_reason text,
    late_fee_waived boolean DEFAULT false NOT NULL,
    discount numeric(12,2) DEFAULT 0 NOT NULL,
    discount_reason text,
    notes text,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    school_id uuid NOT NULL,
    idempotency_key text,
    CONSTRAINT invoices_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'partial'::text, 'paid'::text, 'void'::text])))
);


--
-- Name: late_fee_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE erp.late_fee_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    per_day_amount numeric(10,2) DEFAULT 100 NOT NULL,
    grace_days integer DEFAULT 0 NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    monthly_due_day integer DEFAULT 10 NOT NULL,
    school_id uuid NOT NULL,
    CONSTRAINT late_fee_settings_due_day_chk CHECK (((monthly_due_day >= 1) AND (monthly_due_day <= 28)))
);


--
-- Name: library_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE erp.library_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    max_books_per_student integer DEFAULT 3 NOT NULL,
    loan_days integer DEFAULT 14 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    school_id uuid NOT NULL
);


--
-- Name: marks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE erp.marks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    subject_id uuid NOT NULL,
    exam text NOT NULL,
    academic_year text NOT NULL,
    marks_obtained numeric(6,2),
    max_marks numeric(6,2) DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    school_id uuid NOT NULL
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE erp.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    paid_at timestamp with time zone DEFAULT now() NOT NULL,
    mode text NOT NULL,
    reference text,
    notes text,
    school_id uuid NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE erp.profiles (
    id uuid NOT NULL,
    email text,
    full_name text,
    role text DEFAULT 'staff'::text NOT NULL,
    department text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    phone text,
    school_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    group_id uuid DEFAULT '10000000-0000-0000-0000-000000000001'::uuid,
    CONSTRAINT profiles_department_check CHECK (((department IS NULL) OR (department = ANY (ARRAY['fees'::text, 'academics'::text, 'library'::text, 'results'::text])))),
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'manager'::text, 'staff'::text])))
);


--
-- Name: report_extras; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE erp.report_extras (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    school_id uuid NOT NULL,
    academic_year text NOT NULL,
    exam text NOT NULL,
    field text NOT NULL,
    value text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: result_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE erp.result_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    page_size text DEFAULT 'a4-portrait'::text NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    layout jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT result_templates_page_size_check CHECK ((page_size = ANY (ARRAY['a4-portrait'::text, 'a4-landscape'::text])))
);


--
-- Name: schools; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE erp.schools (
    id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    location text NOT NULL,
    board text,
    board_code text,
    parent_note text,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    group_id uuid NOT NULL
);


--
-- Name: sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE erp.sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    class_id uuid NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    school_id uuid NOT NULL
);


--
-- Name: staff_attendance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE erp.staff_attendance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid NOT NULL,
    date date NOT NULL,
    marked_at timestamp with time zone DEFAULT now() NOT NULL,
    latitude double precision,
    longitude double precision,
    accuracy double precision,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    school_id uuid NOT NULL
);


--
-- Name: student_bus_fee_months; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE erp.student_bus_fee_months (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    student_id uuid NOT NULL,
    academic_year text NOT NULL,
    month_index integer NOT NULL,
    paid_at timestamp with time zone DEFAULT now() NOT NULL,
    marked_by uuid,
    CONSTRAINT student_bus_fee_months_month_index_check CHECK (((month_index >= 1) AND (month_index <= 12)))
);


--
-- Name: cashbook_settings; Type: TABLE; Schema: public; Owner: - (migration 0032)
--

CREATE TABLE erp.cashbook_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    opening_balance numeric(12,2) DEFAULT 0 NOT NULL,
    opening_date date,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cashbook_expenses; Type: TABLE; Schema: public; Owner: - (migration 0032)
--

CREATE TABLE erp.cashbook_expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    spent_on date DEFAULT ((now() AT TIME ZONE 'Asia/Kolkata'::text))::date NOT NULL,
    mode text DEFAULT 'cash'::text NOT NULL,
    category text,
    description text NOT NULL,
    amount numeric(12,2) NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cashbook_expenses_amount_check CHECK ((amount >= (0)::numeric)),
    CONSTRAINT cashbook_expenses_mode_check CHECK ((mode = ANY (ARRAY['cash'::text, 'cheque'::text, 'upi'::text, 'inb'::text])))
);


--
-- Name: bank_deposits; Type: TABLE; Schema: public; Owner: - (migration 0032)
--

CREATE TABLE erp.bank_deposits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    deposited_on date DEFAULT ((now() AT TIME ZONE 'Asia/Kolkata'::text))::date NOT NULL,
    amount numeric(12,2) NOT NULL,
    bank_name text,
    deposit_receipt_no text,
    reference text,
    notes text,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bank_deposits_amount_check CHECK ((amount >= (0)::numeric))
);


--
-- Name: student_opening_dues; Type: TABLE; Schema: public; Owner: - (migration 0033)
--

CREATE TABLE erp.student_opening_dues (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    student_id uuid NOT NULL,
    academic_year text NOT NULL,
    amount numeric(12,2) DEFAULT 0 NOT NULL,
    breakdown jsonb,
    source text DEFAULT 'import 2025-26'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: students; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE erp.students (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admission_no text,
    full_name text NOT NULL,
    class_id uuid,
    section text,
    gender text,
    blood_group text,
    date_of_birth date,
    father_name text,
    mother_name text,
    contact_number text,
    alt_contact text,
    address text,
    is_hosteller boolean DEFAULT false NOT NULL,
    is_new_admission boolean DEFAULT false NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    student_photo_url text,
    parent_photo_url text,
    school_id uuid NOT NULL,
    bus_fee_amount integer,
    father_mobile text,
    mother_mobile text,
    category text DEFAULT 'regular'::text NOT NULL,
    CONSTRAINT students_category_check CHECK ((category = ANY (ARRAY['regular'::text, 'rte'::text, 'staff_child'::text])))
);


--
-- Name: subjects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE erp.subjects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    class_id uuid NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    category text DEFAULT 'scholastic'::text NOT NULL,
    school_id uuid NOT NULL,
    CONSTRAINT subjects_category_check CHECK ((category = ANY (ARRAY['scholastic'::text, 'co_curricular'::text])))
);


--
-- Name: attendance attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.attendance
    ADD CONSTRAINT attendance_pkey PRIMARY KEY (id);


--
-- Name: attendance attendance_student_id_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.attendance
    ADD CONSTRAINT attendance_student_id_date_key UNIQUE (student_id, date);


--
-- Name: book_loans book_loans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.book_loans
    ADD CONSTRAINT book_loans_pkey PRIMARY KEY (id);


--
-- Name: book_requests book_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.book_requests
    ADD CONSTRAINT book_requests_pkey PRIMARY KEY (id);


--
-- Name: books books_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.books
    ADD CONSTRAINT books_code_key UNIQUE (code);


--
-- Name: books books_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.books
    ADD CONSTRAINT books_pkey PRIMARY KEY (id);


--
-- Name: change_requests change_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.change_requests
    ADD CONSTRAINT change_requests_pkey PRIMARY KEY (id);


--
-- Name: classes classes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.classes
    ADD CONSTRAINT classes_pkey PRIMARY KEY (id);


--
-- Name: co_curricular_grades co_curricular_grades_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.co_curricular_grades
    ADD CONSTRAINT co_curricular_grades_pkey PRIMARY KEY (id);


--
-- Name: co_curricular_grades co_curricular_grades_student_id_subject_id_academic_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.co_curricular_grades
    ADD CONSTRAINT co_curricular_grades_student_id_subject_id_academic_year_key UNIQUE (student_id, subject_id, academic_year);


--
-- Name: fee_print_settings fee_print_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.fee_print_settings
    ADD CONSTRAINT fee_print_settings_pkey PRIMARY KEY (id);


--
-- Name: fee_print_settings fee_print_settings_school_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.fee_print_settings
    ADD CONSTRAINT fee_print_settings_school_id_key UNIQUE (school_id);


--
-- Name: fee_structure_components fee_structure_components_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.fee_structure_components
    ADD CONSTRAINT fee_structure_components_pkey PRIMARY KEY (id);


--
-- Name: fee_structures fee_structures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.fee_structures
    ADD CONSTRAINT fee_structures_pkey PRIMARY KEY (id);


--
-- Name: groups groups_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.groups
    ADD CONSTRAINT groups_code_key UNIQUE (code);


--
-- Name: groups groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.groups
    ADD CONSTRAINT groups_pkey PRIMARY KEY (id);


--
-- Name: invoice_items invoice_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.invoice_items
    ADD CONSTRAINT invoice_items_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_receipt_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.invoices
    ADD CONSTRAINT invoices_receipt_no_key UNIQUE (receipt_no);


--
-- Name: late_fee_settings late_fee_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.late_fee_settings
    ADD CONSTRAINT late_fee_settings_pkey PRIMARY KEY (id);


--
-- Name: library_settings library_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.library_settings
    ADD CONSTRAINT library_settings_pkey PRIMARY KEY (id);


--
-- Name: marks marks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.marks
    ADD CONSTRAINT marks_pkey PRIMARY KEY (id);


--
-- Name: marks marks_student_id_subject_id_exam_academic_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.marks
    ADD CONSTRAINT marks_student_id_subject_id_exam_academic_year_key UNIQUE (student_id, subject_id, exam, academic_year);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: report_extras report_extras_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.report_extras
    ADD CONSTRAINT report_extras_pkey PRIMARY KEY (id);


--
-- Name: report_extras report_extras_student_id_academic_year_exam_field_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.report_extras
    ADD CONSTRAINT report_extras_student_id_academic_year_exam_field_key UNIQUE (student_id, academic_year, exam, field);


--
-- Name: result_templates result_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.result_templates
    ADD CONSTRAINT result_templates_pkey PRIMARY KEY (id);


--
-- Name: schools schools_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.schools
    ADD CONSTRAINT schools_code_key UNIQUE (code);


--
-- Name: schools schools_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.schools
    ADD CONSTRAINT schools_pkey PRIMARY KEY (id);


--
-- Name: sections sections_class_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.sections
    ADD CONSTRAINT sections_class_id_name_key UNIQUE (class_id, name);


--
-- Name: sections sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.sections
    ADD CONSTRAINT sections_pkey PRIMARY KEY (id);


--
-- Name: staff_attendance staff_attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.staff_attendance
    ADD CONSTRAINT staff_attendance_pkey PRIMARY KEY (id);


--
-- Name: staff_attendance staff_attendance_profile_id_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.staff_attendance
    ADD CONSTRAINT staff_attendance_profile_id_date_key UNIQUE (profile_id, date);


--
-- Name: student_bus_fee_months student_bus_fee_months_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.student_bus_fee_months
    ADD CONSTRAINT student_bus_fee_months_pkey PRIMARY KEY (id);


--
-- Name: student_bus_fee_months student_bus_fee_months_student_id_academic_year_month_index_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.student_bus_fee_months
    ADD CONSTRAINT student_bus_fee_months_student_id_academic_year_month_index_key UNIQUE (student_id, academic_year, month_index);


--
-- Name: students students_admission_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.students
    ADD CONSTRAINT students_admission_no_key UNIQUE (admission_no);


--
-- Name: students students_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.students
    ADD CONSTRAINT students_pkey PRIMARY KEY (id);


--
-- Name: subjects subjects_class_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.subjects
    ADD CONSTRAINT subjects_class_id_name_key UNIQUE (class_id, name);


--
-- Name: subjects subjects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.subjects
    ADD CONSTRAINT subjects_pkey PRIMARY KEY (id);


--
-- Name: attendance_class_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX attendance_class_date_idx ON erp.attendance USING btree (class_id, date);


--
-- Name: attendance_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX attendance_date_idx ON erp.attendance USING btree (date);


--
-- Name: attendance_school_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX attendance_school_idx ON erp.attendance USING btree (school_id);


--
-- Name: attendance_student_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX attendance_student_idx ON erp.attendance USING btree (student_id);


--
-- Name: book_loans_book_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX book_loans_book_idx ON erp.book_loans USING btree (book_id);


--
-- Name: book_loans_one_open_per_book; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX book_loans_one_open_per_book ON erp.book_loans USING btree (book_id) WHERE (returned_at IS NULL);


--
-- Name: book_loans_school_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX book_loans_school_idx ON erp.book_loans USING btree (school_id);


--
-- Name: book_loans_student_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX book_loans_student_idx ON erp.book_loans USING btree (student_id);


--
-- Name: book_requests_school_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX book_requests_school_idx ON erp.book_requests USING btree (school_id);


--
-- Name: book_requests_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX book_requests_status_idx ON erp.book_requests USING btree (status);


--
-- Name: books_school_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX books_school_idx ON erp.books USING btree (school_id);


--
-- Name: books_title_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX books_title_idx ON erp.books USING btree (title);


--
-- Name: ccg_student_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ccg_student_idx ON erp.co_curricular_grades USING btree (student_id);


--
-- Name: ccg_year_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ccg_year_idx ON erp.co_curricular_grades USING btree (academic_year);


--
-- Name: change_requests_school_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX change_requests_school_idx ON erp.change_requests USING btree (school_id);


--
-- Name: change_requests_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX change_requests_status_idx ON erp.change_requests USING btree (status);


--
-- Name: classes_school_code_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX classes_school_code_uniq ON erp.classes USING btree (school_id, code);


--
-- Name: classes_school_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX classes_school_idx ON erp.classes USING btree (school_id);


--
-- Name: co_curricular_grades_school_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX co_curricular_grades_school_idx ON erp.co_curricular_grades USING btree (school_id);


--
-- Name: fee_structure_components_school_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fee_structure_components_school_idx ON erp.fee_structure_components USING btree (school_id);


--
-- Name: fee_structures_school_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fee_structures_school_idx ON erp.fee_structures USING btree (school_id);


--
-- Name: fee_structures_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX fee_structures_uniq ON erp.fee_structures USING btree (academic_year, scope, class_id, group_label, student_kind) NULLS NOT DISTINCT;


--
-- Name: fsc_struct_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fsc_struct_idx ON erp.fee_structure_components USING btree (structure_id);


--
-- Name: invoice_items_inv_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_items_inv_idx ON erp.invoice_items USING btree (invoice_id);


--
-- Name: invoice_items_school_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_items_school_idx ON erp.invoice_items USING btree (school_id);


--
-- Name: invoices_idempotency_key_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX invoices_idempotency_key_uidx ON erp.invoices USING btree (school_id, idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- Name: invoices_school_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoices_school_idx ON erp.invoices USING btree (school_id);


--
-- Name: invoices_student_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoices_student_idx ON erp.invoices USING btree (student_id);


--
-- Name: invoices_year_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoices_year_idx ON erp.invoices USING btree (academic_year);


--
-- Name: late_fee_settings_school_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX late_fee_settings_school_idx ON erp.late_fee_settings USING btree (school_id);


--
-- Name: library_settings_school_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX library_settings_school_idx ON erp.library_settings USING btree (school_id);


--
-- Name: marks_school_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marks_school_idx ON erp.marks USING btree (school_id);


--
-- Name: marks_student_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marks_student_idx ON erp.marks USING btree (student_id);


--
-- Name: marks_subject_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marks_subject_idx ON erp.marks USING btree (subject_id);


--
-- Name: marks_year_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marks_year_idx ON erp.marks USING btree (academic_year);


--
-- Name: payments_school_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payments_school_idx ON erp.payments USING btree (school_id);


--
-- Name: profiles_group_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profiles_group_idx ON erp.profiles USING btree (group_id);


--
-- Name: profiles_phone_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX profiles_phone_uniq ON erp.profiles USING btree (phone) WHERE (phone IS NOT NULL);


--
-- Name: profiles_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profiles_role_idx ON erp.profiles USING btree (role);


--
-- Name: report_extras_school_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX report_extras_school_idx ON erp.report_extras USING btree (school_id);


--
-- Name: report_extras_student_year_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX report_extras_student_year_idx ON erp.report_extras USING btree (student_id, academic_year);


--
-- Name: result_templates_name_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX result_templates_name_uniq ON erp.result_templates USING btree (lower(name));


--
-- Name: result_templates_one_default; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX result_templates_one_default ON erp.result_templates USING btree (is_default) WHERE (is_default = true);


--
-- Name: sbfm_school_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sbfm_school_idx ON erp.student_bus_fee_months USING btree (school_id);


--
-- Name: sbfm_student_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sbfm_student_idx ON erp.student_bus_fee_months USING btree (student_id, academic_year);


--
-- Name: schools_group_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schools_group_idx ON erp.schools USING btree (group_id);


--
-- Name: sections_class_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sections_class_idx ON erp.sections USING btree (class_id);


--
-- Name: sections_school_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sections_school_idx ON erp.sections USING btree (school_id);


--
-- Name: staff_attendance_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX staff_attendance_date_idx ON erp.staff_attendance USING btree (date);


--
-- Name: staff_attendance_profile_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX staff_attendance_profile_idx ON erp.staff_attendance USING btree (profile_id);


--
-- Name: staff_attendance_school_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX staff_attendance_school_idx ON erp.staff_attendance USING btree (school_id);


--
-- Name: students_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX students_category_idx ON erp.students USING btree (category);


--
-- Name: students_class_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX students_class_idx ON erp.students USING btree (class_id);


--
-- Name: students_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX students_name_idx ON erp.students USING btree (full_name);


--
-- Name: students_school_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX students_school_idx ON erp.students USING btree (school_id);


--
-- Name: subjects_class_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX subjects_class_idx ON erp.subjects USING btree (class_id);


--
-- Name: subjects_school_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX subjects_school_idx ON erp.subjects USING btree (school_id);


--
-- Name: invoices set_receipt_no_trg; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_receipt_no_trg BEFORE INSERT ON erp.invoices FOR EACH ROW EXECUTE FUNCTION erp.set_receipt_no();


--
-- Name: profiles trg_profiles_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_profiles_touch BEFORE UPDATE ON erp.profiles FOR EACH ROW EXECUTE FUNCTION erp.touch_updated_at();


--
-- Name: result_templates trg_result_templates_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_result_templates_touch BEFORE UPDATE ON erp.result_templates FOR EACH ROW EXECUTE FUNCTION erp.result_templates_touch_updated_at();


--
-- Name: attendance attendance_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.attendance
    ADD CONSTRAINT attendance_class_id_fkey FOREIGN KEY (class_id) REFERENCES erp.classes(id) ON DELETE SET NULL;


--
-- Name: attendance attendance_school_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.attendance
    ADD CONSTRAINT attendance_school_fk FOREIGN KEY (school_id) REFERENCES erp.schools(id) ON DELETE RESTRICT;


--
-- Name: attendance attendance_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.attendance
    ADD CONSTRAINT attendance_student_id_fkey FOREIGN KEY (student_id) REFERENCES erp.students(id) ON DELETE CASCADE;


--
-- Name: book_loans book_loans_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.book_loans
    ADD CONSTRAINT book_loans_book_id_fkey FOREIGN KEY (book_id) REFERENCES erp.books(id) ON DELETE CASCADE;


--
-- Name: book_loans book_loans_school_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.book_loans
    ADD CONSTRAINT book_loans_school_fk FOREIGN KEY (school_id) REFERENCES erp.schools(id) ON DELETE RESTRICT;


--
-- Name: book_loans book_loans_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.book_loans
    ADD CONSTRAINT book_loans_student_id_fkey FOREIGN KEY (student_id) REFERENCES erp.students(id) ON DELETE CASCADE;


--
-- Name: book_requests book_requests_school_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.book_requests
    ADD CONSTRAINT book_requests_school_fk FOREIGN KEY (school_id) REFERENCES erp.schools(id) ON DELETE RESTRICT;


--
-- Name: books books_school_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.books
    ADD CONSTRAINT books_school_fk FOREIGN KEY (school_id) REFERENCES erp.schools(id) ON DELETE RESTRICT;


--
-- Name: change_requests change_requests_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.change_requests
    ADD CONSTRAINT change_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES erp.profiles(id) ON DELETE SET NULL;


--
-- Name: change_requests change_requests_school_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.change_requests
    ADD CONSTRAINT change_requests_school_fk FOREIGN KEY (school_id) REFERENCES erp.schools(id) ON DELETE RESTRICT;


--
-- Name: classes classes_school_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.classes
    ADD CONSTRAINT classes_school_fk FOREIGN KEY (school_id) REFERENCES erp.schools(id) ON DELETE RESTRICT;


--
-- Name: co_curricular_grades co_curricular_grades_school_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.co_curricular_grades
    ADD CONSTRAINT co_curricular_grades_school_fk FOREIGN KEY (school_id) REFERENCES erp.schools(id) ON DELETE RESTRICT;


--
-- Name: co_curricular_grades co_curricular_grades_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.co_curricular_grades
    ADD CONSTRAINT co_curricular_grades_student_id_fkey FOREIGN KEY (student_id) REFERENCES erp.students(id) ON DELETE CASCADE;


--
-- Name: co_curricular_grades co_curricular_grades_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.co_curricular_grades
    ADD CONSTRAINT co_curricular_grades_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES erp.subjects(id) ON DELETE CASCADE;


--
-- Name: fee_print_settings fee_print_settings_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.fee_print_settings
    ADD CONSTRAINT fee_print_settings_school_id_fkey FOREIGN KEY (school_id) REFERENCES erp.schools(id) ON DELETE CASCADE;


--
-- Name: fee_structure_components fee_structure_components_school_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.fee_structure_components
    ADD CONSTRAINT fee_structure_components_school_fk FOREIGN KEY (school_id) REFERENCES erp.schools(id) ON DELETE RESTRICT;


--
-- Name: fee_structure_components fee_structure_components_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.fee_structure_components
    ADD CONSTRAINT fee_structure_components_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES erp.fee_structures(id) ON DELETE CASCADE;


--
-- Name: fee_structures fee_structures_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.fee_structures
    ADD CONSTRAINT fee_structures_class_id_fkey FOREIGN KEY (class_id) REFERENCES erp.classes(id) ON DELETE CASCADE;


--
-- Name: fee_structures fee_structures_school_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.fee_structures
    ADD CONSTRAINT fee_structures_school_fk FOREIGN KEY (school_id) REFERENCES erp.schools(id) ON DELETE RESTRICT;


--
-- Name: invoice_items invoice_items_component_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.invoice_items
    ADD CONSTRAINT invoice_items_component_id_fkey FOREIGN KEY (component_id) REFERENCES erp.fee_structure_components(id) ON DELETE SET NULL;


--
-- Name: invoice_items invoice_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.invoice_items
    ADD CONSTRAINT invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES erp.invoices(id) ON DELETE CASCADE;


--
-- Name: invoice_items invoice_items_school_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.invoice_items
    ADD CONSTRAINT invoice_items_school_fk FOREIGN KEY (school_id) REFERENCES erp.schools(id) ON DELETE RESTRICT;


--
-- Name: invoices invoices_school_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.invoices
    ADD CONSTRAINT invoices_school_fk FOREIGN KEY (school_id) REFERENCES erp.schools(id) ON DELETE RESTRICT;


--
-- Name: invoices invoices_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.invoices
    ADD CONSTRAINT invoices_student_id_fkey FOREIGN KEY (student_id) REFERENCES erp.students(id) ON DELETE RESTRICT;


--
-- Name: late_fee_settings late_fee_settings_school_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.late_fee_settings
    ADD CONSTRAINT late_fee_settings_school_fk FOREIGN KEY (school_id) REFERENCES erp.schools(id) ON DELETE RESTRICT;


--
-- Name: library_settings library_settings_school_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.library_settings
    ADD CONSTRAINT library_settings_school_fk FOREIGN KEY (school_id) REFERENCES erp.schools(id) ON DELETE RESTRICT;


--
-- Name: marks marks_school_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.marks
    ADD CONSTRAINT marks_school_fk FOREIGN KEY (school_id) REFERENCES erp.schools(id) ON DELETE RESTRICT;


--
-- Name: marks marks_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.marks
    ADD CONSTRAINT marks_student_id_fkey FOREIGN KEY (student_id) REFERENCES erp.students(id) ON DELETE CASCADE;


--
-- Name: marks marks_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.marks
    ADD CONSTRAINT marks_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES erp.subjects(id) ON DELETE CASCADE;


--
-- Name: payments payments_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.payments
    ADD CONSTRAINT payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES erp.invoices(id) ON DELETE CASCADE;


--
-- Name: payments payments_school_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.payments
    ADD CONSTRAINT payments_school_fk FOREIGN KEY (school_id) REFERENCES erp.schools(id) ON DELETE RESTRICT;


--
-- Name: profiles profiles_group_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.profiles
    ADD CONSTRAINT profiles_group_fk FOREIGN KEY (group_id) REFERENCES erp.groups(id) ON DELETE RESTRICT;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: report_extras report_extras_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.report_extras
    ADD CONSTRAINT report_extras_school_id_fkey FOREIGN KEY (school_id) REFERENCES erp.schools(id) ON DELETE CASCADE;


--
-- Name: report_extras report_extras_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.report_extras
    ADD CONSTRAINT report_extras_student_id_fkey FOREIGN KEY (student_id) REFERENCES erp.students(id) ON DELETE CASCADE;


--
-- Name: schools schools_group_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.schools
    ADD CONSTRAINT schools_group_fk FOREIGN KEY (group_id) REFERENCES erp.groups(id) ON DELETE RESTRICT;


--
-- Name: sections sections_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.sections
    ADD CONSTRAINT sections_class_id_fkey FOREIGN KEY (class_id) REFERENCES erp.classes(id) ON DELETE CASCADE;


--
-- Name: sections sections_school_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.sections
    ADD CONSTRAINT sections_school_fk FOREIGN KEY (school_id) REFERENCES erp.schools(id) ON DELETE RESTRICT;


--
-- Name: staff_attendance staff_attendance_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.staff_attendance
    ADD CONSTRAINT staff_attendance_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES erp.profiles(id) ON DELETE CASCADE;


--
-- Name: staff_attendance staff_attendance_school_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.staff_attendance
    ADD CONSTRAINT staff_attendance_school_fk FOREIGN KEY (school_id) REFERENCES erp.schools(id) ON DELETE RESTRICT;


--
-- Name: student_bus_fee_months student_bus_fee_months_marked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.student_bus_fee_months
    ADD CONSTRAINT student_bus_fee_months_marked_by_fkey FOREIGN KEY (marked_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: student_bus_fee_months student_bus_fee_months_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.student_bus_fee_months
    ADD CONSTRAINT student_bus_fee_months_school_id_fkey FOREIGN KEY (school_id) REFERENCES erp.schools(id) ON DELETE CASCADE;


--
-- Name: student_bus_fee_months student_bus_fee_months_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.student_bus_fee_months
    ADD CONSTRAINT student_bus_fee_months_student_id_fkey FOREIGN KEY (student_id) REFERENCES erp.students(id) ON DELETE CASCADE;


--
-- Name: students students_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.students
    ADD CONSTRAINT students_class_id_fkey FOREIGN KEY (class_id) REFERENCES erp.classes(id) ON DELETE SET NULL;


--
-- Name: students students_school_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.students
    ADD CONSTRAINT students_school_fk FOREIGN KEY (school_id) REFERENCES erp.schools(id) ON DELETE RESTRICT;


--
-- Name: subjects subjects_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.subjects
    ADD CONSTRAINT subjects_class_id_fkey FOREIGN KEY (class_id) REFERENCES erp.classes(id) ON DELETE CASCADE;


--
-- Name: subjects subjects_school_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY erp.subjects
    ADD CONSTRAINT subjects_school_fk FOREIGN KEY (school_id) REFERENCES erp.schools(id) ON DELETE RESTRICT;


--
-- Name: attendance anon_all_attendance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_all_attendance ON erp.attendance TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: book_loans anon_all_book_loans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_all_book_loans ON erp.book_loans TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: book_requests anon_all_book_requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_all_book_requests ON erp.book_requests TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: books anon_all_books; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_all_books ON erp.books TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: change_requests anon_all_change_requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_all_change_requests ON erp.change_requests TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: classes anon_all_classes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_all_classes ON erp.classes TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: co_curricular_grades anon_all_co_curricular_grades; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_all_co_curricular_grades ON erp.co_curricular_grades TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: fee_print_settings anon_all_fee_print_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_all_fee_print_settings ON erp.fee_print_settings USING (true) WITH CHECK (true);


--
-- Name: fee_structure_components anon_all_fee_structure_components; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_all_fee_structure_components ON erp.fee_structure_components TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: fee_structures anon_all_fee_structures; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_all_fee_structures ON erp.fee_structures TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: groups anon_all_groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_all_groups ON erp.groups USING (true) WITH CHECK (true);


--
-- Name: invoice_items anon_all_invoice_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_all_invoice_items ON erp.invoice_items TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: invoices anon_all_invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_all_invoices ON erp.invoices TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: late_fee_settings anon_all_late_fee_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_all_late_fee_settings ON erp.late_fee_settings TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: library_settings anon_all_library_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_all_library_settings ON erp.library_settings TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: marks anon_all_marks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_all_marks ON erp.marks TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: payments anon_all_payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_all_payments ON erp.payments TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: report_extras anon_all_report_extras; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_all_report_extras ON erp.report_extras USING (true) WITH CHECK (true);


--
-- Name: result_templates anon_all_result_templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_all_result_templates ON erp.result_templates USING (true) WITH CHECK (true);


--
-- Name: schools anon_all_schools; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_all_schools ON erp.schools USING (true) WITH CHECK (true);


--
-- Name: sections anon_all_sections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_all_sections ON erp.sections TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: staff_attendance anon_all_staff_attendance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_all_staff_attendance ON erp.staff_attendance TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: student_bus_fee_months anon_all_student_bus_fee_months; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_all_student_bus_fee_months ON erp.student_bus_fee_months USING (true) WITH CHECK (true);


--
-- Name: students anon_all_students; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_all_students ON erp.students TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: subjects anon_all_subjects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_all_subjects ON erp.subjects TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: attendance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE erp.attendance ENABLE ROW LEVEL SECURITY;

--
-- Name: book_loans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE erp.book_loans ENABLE ROW LEVEL SECURITY;

--
-- Name: book_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE erp.book_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: books; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE erp.books ENABLE ROW LEVEL SECURITY;

--
-- Name: change_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE erp.change_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: classes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE erp.classes ENABLE ROW LEVEL SECURITY;

--
-- Name: co_curricular_grades; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE erp.co_curricular_grades ENABLE ROW LEVEL SECURITY;

--
-- Name: fee_print_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE erp.fee_print_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: fee_structure_components; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE erp.fee_structure_components ENABLE ROW LEVEL SECURITY;

--
-- Name: fee_structures; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE erp.fee_structures ENABLE ROW LEVEL SECURITY;

--
-- Name: groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE erp.groups ENABLE ROW LEVEL SECURITY;

--
-- Name: invoice_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE erp.invoice_items ENABLE ROW LEVEL SECURITY;

--
-- Name: invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE erp.invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: late_fee_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE erp.late_fee_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: library_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE erp.library_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: marks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE erp.marks ENABLE ROW LEVEL SECURITY;

--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE erp.payments ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE erp.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_insert ON erp.profiles FOR INSERT TO authenticated WITH CHECK ((id = auth.uid()));


--
-- Name: profiles profiles_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select ON erp.profiles FOR SELECT TO authenticated, anon USING (true);


--
-- Name: profiles profiles_service; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_service ON erp.profiles TO service_role USING (true) WITH CHECK (true);


--
-- Name: profiles profiles_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update ON erp.profiles FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));


--
-- Name: report_extras; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE erp.report_extras ENABLE ROW LEVEL SECURITY;

--
-- Name: result_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE erp.result_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: schools; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE erp.schools ENABLE ROW LEVEL SECURITY;

--
-- Name: sections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE erp.sections ENABLE ROW LEVEL SECURITY;

--
-- Name: staff_attendance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE erp.staff_attendance ENABLE ROW LEVEL SECURITY;

--
-- Name: student_bus_fee_months; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE erp.student_bus_fee_months ENABLE ROW LEVEL SECURITY;

--
-- Name: students; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE erp.students ENABLE ROW LEVEL SECURITY;

--
-- Name: subjects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE erp.subjects ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


