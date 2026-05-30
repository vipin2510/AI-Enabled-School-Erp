import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, getCurrentSchoolId } from "@/lib/auth";

const ItemSchema = z.object({
  component_id: z.string().uuid().nullable(),
  description: z.string(),
  kind: z.enum([
    "registration",
    "caution",
    "admission_one_time",
    "yearly",
    "monthly",
    "instalment",
  ]),
  period_index: z.number().int().nullable().optional(),
  amount: z.number().nonnegative(),
  waived: z.boolean().default(false),
  waiver_reason: z.string().nullable().optional(),
});

const BodySchema = z.object({
  student_id: z.string().uuid(),
  academic_year: z.string(),
  items: z.array(ItemSchema).min(1),
  subtotal: z.number().nonnegative(),
  late_fee: z.number().nonnegative(),
  waiver_amount: z.number().nonnegative(),
  total: z.number().nonnegative(),
  late_fee_waived: z.boolean().default(false),
  waiver_reason: z.string().nullable().optional(),
  payment_mode: z.string(),
  payment_ref: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  created_by: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  const profile = await requireProfile();
  const schoolId = await getCurrentSchoolId(profile);
  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const body = parsed.data;
  const supabase = await createClient();

  // Cheque payments start as "pending" (awaiting clearance); every other mode
  // is "paid" (done) on the spot. The receipt page can later flip a pending
  // cheque to done — but never the other way round.
  const isCheque = body.payment_mode === "cheque";

  // Insert invoice
  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .insert({
      school_id: schoolId,
      student_id: body.student_id,
      academic_year: body.academic_year,
      subtotal: body.subtotal,
      late_fee: body.late_fee,
      waiver_amount: body.waiver_amount,
      total: body.total,
      amount_paid: body.total,
      balance: 0,
      payment_status: isCheque ? "pending" : "paid",
      payment_mode: body.payment_mode,
      payment_ref: body.payment_ref ?? null,
      late_fee_waived: body.late_fee_waived,
      waiver_reason: body.waiver_reason ?? null,
      notes: body.notes ?? null,
      created_by: body.created_by ?? null,
    })
    .select("id, receipt_no")
    .single();

  if (invErr || !invoice) {
    return NextResponse.json({ error: invErr?.message ?? "Insert failed" }, { status: 500 });
  }

  // Insert items
  const itemsPayload = body.items.map((i) => ({
    school_id: schoolId,
    invoice_id: invoice.id,
    component_id: i.component_id,
    description: i.description,
    kind: i.kind,
    period_index: i.period_index ?? null,
    amount: i.amount,
    waived: i.waived,
    waiver_reason: i.waiver_reason ?? null,
  }));

  const { error: itemsErr } = await supabase.from("invoice_items").insert(itemsPayload);
  if (itemsErr) {
    // best-effort cleanup
    await supabase.from("invoices").delete().eq("id", invoice.id);
    return NextResponse.json({ error: itemsErr.message }, { status: 500 });
  }

  // Record payment row
  await supabase.from("payments").insert({
    school_id: schoolId,
    invoice_id: invoice.id,
    amount: body.total,
    mode: body.payment_mode,
    reference: body.payment_ref ?? null,
    notes: body.notes ?? null,
  });

  return NextResponse.json({ id: invoice.id, receipt_no: invoice.receipt_no });
}
