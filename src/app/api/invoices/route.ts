import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";

// What the cashier proposes — amounts/totals are NOT trusted; the server
// re-derives them from the DB. Only the per-item flags (waived, kind selected,
// bus add-on) and free-text fields (mode, ref, notes) come from the client.
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
  // Client-supplied amount is accepted but never used as authoritative — we
  // overwrite it with the value pulled from fee_structure_components (or, for
  // synthetic bus-fee rows, from the student's bus_fee_amount).
  amount: z.number().nonnegative(),
  waived: z.boolean().default(false),
  waiver_reason: z.string().nullable().optional(),
});

const BodySchema = z.object({
  student_id: z.string().uuid(),
  academic_year: z.string(),
  items: z.array(ItemSchema).min(1),
  // Subtotal/late_fee/waiver/total are read for cross-checking only; the
  // server's recomputed values win and the client values are discarded.
  subtotal: z.number().nonnegative(),
  late_fee: z.number().nonnegative(),
  waiver_amount: z.number().nonnegative(),
  total: z.number().nonnegative(),
  late_fee_waived: z.boolean().default(false),
  waiver_reason: z.string().nullable().optional(),
  payment_mode: z.enum(["cash", "upi", "card", "bank", "cheque"]),
  payment_ref: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  created_by: z.string().nullable().optional(),
  paid_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  // Optional idempotency token: the form generates one per Collect click so a
  // double-tap can't write the receipt twice. See `idempotency_key` column on
  // invoices (migration 0014).
  idempotency_key: z.string().min(8).max(128).optional(),
});

// Bus-fee synthetic rows look exactly like this — we never accept a
// no-component row that doesn't match.
const BUS_DESC_RE = /^Bus Fee\b/;

export async function POST(req: Request) {
  // Only fees department (admin/manager/staff-fees) may collect — not any
  // logged-in user. Closes the "any session writes invoices" hole.
  const profile = await requireDepartment("fees");
  const schoolId = await getCurrentSchoolId(profile);
  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const body = parsed.data;
  const supabase = await createClient();

  // 1) Student must belong to the caller's school. Stops cross-school writes
  //    where a known UUID from another tenant gets posted here.
  const { data: student, error: studentErr } = await supabase
    .from("students")
    .select("id, bus_fee_amount")
    .eq("school_id", schoolId)
    .eq("id", body.student_id)
    .maybeSingle();
  if (studentErr) {
    return NextResponse.json({ error: studentErr.message }, { status: 500 });
  }
  if (!student) {
    return NextResponse.json({ error: "Student not found in this school." }, { status: 404 });
  }

  // 2) Idempotency: if the form already created an invoice for this key,
  //    return that one instead of writing a duplicate. Tolerant of pre-
  //    migration deployments — if the column doesn't exist, skip the check.
  if (body.idempotency_key) {
    const { data: existing } = await supabase
      .from("invoices")
      .select("id, receipt_no")
      .eq("school_id", schoolId)
      .eq("idempotency_key", body.idempotency_key)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ id: existing.id, receipt_no: existing.receipt_no });
    }
  }

  // 3) Re-fetch every referenced fee component and verify it belongs to this
  //    school + AY. We use the DB amount as the authoritative price, ignoring
  //    whatever the client sent for `amount`. Any unknown id → reject.
  const componentIds = Array.from(
    new Set(body.items.map((i) => i.component_id).filter((v): v is string => !!v))
  );

  const componentMap = new Map<
    string,
    { id: string; amount: number; kind: string; period_index: number | null; label: string; structure_school: string; structure_year: string }
  >();
  if (componentIds.length) {
    const { data: comps, error: compErr } = await supabase
      .from("fee_structure_components")
      .select(
        "id, amount, kind, period_index, label, fee_structures!inner(school_id, academic_year)"
      )
      .in("id", componentIds);
    if (compErr) {
      return NextResponse.json({ error: compErr.message }, { status: 500 });
    }
    for (const c of (comps ?? []) as unknown as {
      id: string;
      amount: number;
      kind: string;
      period_index: number | null;
      label: string;
      fee_structures: { school_id: string; academic_year: string };
    }[]) {
      if (c.fee_structures.school_id !== schoolId) continue;
      if (c.fee_structures.academic_year !== body.academic_year) continue;
      componentMap.set(c.id, {
        id: c.id,
        amount: Number(c.amount),
        kind: c.kind,
        period_index: c.period_index,
        label: c.label,
        structure_school: c.fee_structures.school_id,
        structure_year: c.fee_structures.academic_year,
      });
    }
    if (componentMap.size !== componentIds.length) {
      return NextResponse.json(
        { error: "One or more fee components don't belong to this school / academic year." },
        { status: 400 },
      );
    }
  }

  // 4) Rebuild the items with DB-priced amounts. Bus-fee synthetic rows
  //    (component_id == null) must match the student's bus_fee_amount, be
  //    kind=monthly, and have a valid period_index. Anything else is rejected.
  const busFee = Number(student.bus_fee_amount ?? 0);

  type SafeItem = {
    school_id: string;
    invoice_id: string;
    component_id: string | null;
    description: string;
    kind: string;
    period_index: number | null;
    amount: number;
    waived: boolean;
    waiver_reason: string | null;
  };
  const safeItems: Omit<SafeItem, "invoice_id">[] = [];
  let subtotal = 0;
  let waiverAmount = 0;

  for (const item of body.items) {
    if (item.component_id) {
      const comp = componentMap.get(item.component_id)!;
      const amount = comp.amount;
      safeItems.push({
        school_id: schoolId,
        component_id: comp.id,
        description: comp.label,
        kind: comp.kind,
        period_index: comp.period_index,
        amount,
        waived: !!item.waived,
        waiver_reason: item.waived ? item.waiver_reason ?? null : null,
      });
      if (item.waived) waiverAmount += amount;
      else subtotal += amount;
      continue;
    }
    // Synthetic row: bus fee only. Anything else → reject (would otherwise let
    // a malicious client inject a ₹0 line for any description).
    if (!BUS_DESC_RE.test(item.description)) {
      return NextResponse.json(
        { error: `Unknown line item "${item.description}".` },
        { status: 400 },
      );
    }
    if (busFee <= 0) {
      return NextResponse.json(
        { error: "Bus fee posted but student is not on the bus." },
        { status: 400 },
      );
    }
    if (item.kind !== "monthly" || item.period_index == null || item.period_index < 1 || item.period_index > 12) {
      return NextResponse.json(
        { error: "Bus fee line is missing a valid month." },
        { status: 400 },
      );
    }
    safeItems.push({
      school_id: schoolId,
      component_id: null,
      description: item.description,
      kind: "monthly",
      period_index: item.period_index,
      amount: busFee,
      waived: false,
      waiver_reason: null,
    });
    subtotal += busFee;
  }

  // 5) Late fee: trust the cashier's `late_fee_waived` flag, then cap the
  //    client-supplied late fee at a sane bound rather than fully recomputing
  //    here (the per-component due-date math lives in the form and depends on
  //    live settings the client already fetched). Cap = subtotal × 1 — late
  //    fees are never larger than the principal in practice; protects against
  //    a tampered client inflating revenue.
  const lateFee = body.late_fee_waived ? 0 : Math.min(Number(body.late_fee), subtotal);
  const total = subtotal + lateFee;
  if (total <= 0) {
    return NextResponse.json({ error: "Nothing to collect." }, { status: 400 });
  }

  // Cheque payments start as "pending" (awaiting clearance); every other mode
  // is "paid" on the spot.
  const isCheque = body.payment_mode === "cheque";

  // Anchor issued_at at noon IST so the displayed day never drifts across TZ.
  const issuedAt = body.paid_at ? `${body.paid_at}T12:00:00+05:30` : undefined;

  // 6) Insert invoice + items + payment. Postgres doesn't give us a single
  //    transaction across multiple supabase-js calls, so we do best-effort
  //    cleanup on item insert failure.
  const insertPayload: Record<string, unknown> = {
    school_id: schoolId,
    student_id: body.student_id,
    academic_year: body.academic_year,
    subtotal,
    late_fee: lateFee,
    waiver_amount: waiverAmount,
    total,
    amount_paid: total,
    balance: 0,
    payment_status: isCheque ? "pending" : "paid",
    payment_mode: body.payment_mode,
    payment_ref: body.payment_ref ?? null,
    late_fee_waived: body.late_fee_waived,
    waiver_reason: body.waiver_reason ?? null,
    notes: body.notes ?? null,
    // Stamp who generated the receipt. Always the signed-in user — the client
    // cannot set this (the form field is read-only), so body.created_by is
    // ignored here on purpose.
    created_by: profile.full_name || null,
  };
  if (issuedAt) insertPayload.issued_at = issuedAt;
  if (body.idempotency_key) insertPayload.idempotency_key = body.idempotency_key;

  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .insert(insertPayload)
    .select("id, receipt_no")
    .single();

  if (invErr || !invoice) {
    return NextResponse.json({ error: invErr?.message ?? "Insert failed" }, { status: 500 });
  }

  const itemsPayload = safeItems.map((i) => ({ ...i, invoice_id: invoice.id }));
  const { error: itemsErr } = await supabase.from("invoice_items").insert(itemsPayload);
  if (itemsErr) {
    await supabase.from("invoices").delete().eq("id", invoice.id);
    return NextResponse.json({ error: itemsErr.message }, { status: 500 });
  }

  const { error: payErr } = await supabase.from("payments").insert({
    school_id: schoolId,
    invoice_id: invoice.id,
    amount: total,
    mode: body.payment_mode,
    reference: body.payment_ref ?? null,
    notes: body.notes ?? null,
  });
  if (payErr) {
    // Items already wrote — leaving the row but without payment is recoverable.
    // The receipt page can still show it; flag in the response so the form can
    // surface the warning.
    return NextResponse.json(
      { id: invoice.id, receipt_no: invoice.receipt_no, warning: payErr.message },
    );
  }

  return NextResponse.json({ id: invoice.id, receipt_no: invoice.receipt_no });
}
