import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, getCurrentSchoolId } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Marking a receipt "Done" is a one-way trip: a pending (cheque) receipt can be
// flipped to paid once it clears, but a paid receipt can never go back to
// pending. The only accepted target status is therefore "paid".
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await requireProfile();
  const schoolId = await getCurrentSchoolId(profile);
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  if (body?.status !== "paid") {
    return NextResponse.json(
      { error: "Receipts can only be marked Done." },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { data: current, error: readErr } = await supabase
    .from("invoices")
    .select("payment_status")
    .eq("school_id", schoolId)
    .eq("id", id)
    .single();

  if (readErr || !current) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }

  if (current.payment_status === "paid") {
    return NextResponse.json({ ok: true, status: "paid" });
  }

  if (current.payment_status !== "pending") {
    return NextResponse.json(
      { error: `Cannot change a ${current.payment_status} receipt.` },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("invoices")
    .update({ payment_status: "paid" })
    .eq("school_id", schoolId)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: "paid" });
}
