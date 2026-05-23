export type FeeKind =
  | "registration"
  | "caution"
  | "admission_one_time"
  | "yearly"
  | "monthly"
  | "instalment";

export type Scope = "school" | "hostel";

export interface ClassRow {
  id: string;
  code: string;
  display_name: string;
  ordinal: number;
  stream: string | null;
  group_label: string | null;
}

export interface Student {
  id: string;
  admission_no: string | null;
  full_name: string;
  class_id: string | null;
  section: string | null;
  gender: string | null;
  blood_group: string | null;
  date_of_birth: string | null;
  father_name: string | null;
  mother_name: string | null;
  contact_number: string | null;
  alt_contact: string | null;
  address: string | null;
  is_hosteller: boolean;
  is_new_admission: boolean;
  status: string;
  created_at: string;
  updated_at: string;
  classes?: ClassRow | null;
}

export interface FeeStructure {
  id: string;
  academic_year: string;
  scope: Scope;
  class_id: string | null;
  group_label: string | null;
  student_kind: "new" | "old" | "any";
  total_amount: number;
}

export interface FeeComponent {
  id: string;
  structure_id: string;
  kind: FeeKind;
  label: string;
  period_index: number | null;
  amount: number;
  due_date: string | null;
  is_refundable: boolean;
  is_one_time: boolean;
  sort_order: number;
}

export interface Invoice {
  id: string;
  receipt_no: string | null;
  student_id: string;
  academic_year: string;
  issued_at: string;
  subtotal: number;
  late_fee: number;
  waiver_amount: number;
  total: number;
  amount_paid: number;
  balance: number;
  payment_status: "pending" | "partial" | "paid" | "void";
  payment_mode: string | null;
  payment_ref: string | null;
  waiver_reason: string | null;
  late_fee_waived: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  component_id: string | null;
  description: string;
  kind: FeeKind;
  period_index: number | null;
  amount: number;
  waived: boolean;
  waiver_reason: string | null;
}
