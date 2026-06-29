import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import { inr, formatDate } from "@/lib/utils";
import ReceiptStatus from "./receipt-status";
import { DownloadButton } from "@/components/ui/download-button";
import { PreviewButton } from "@/components/ui/preview-button";

export const dynamic = "force-dynamic";

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireDepartment("fees");
  const schoolId = await getCurrentSchoolId(profile);
  const { id } = await params;
  const supabase = await createClient();

  // .single() returns an error when no row matches — distinguish "not found"
  // (treat as 404) from "real DB error" (let the error boundary catch it).
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select(
      "*, students(full_name, section, father_name, contact_number, classes(display_name)), invoice_items(*)"
    )
    .eq("school_id", schoolId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!invoice) notFound();

  const s = (invoice as unknown as {
    students: {
      full_name: string;
      section: string | null;
      father_name: string | null;
      contact_number: string | null;
      classes: { display_name: string } | null;
    };
  }).students;

  const items = invoice.invoice_items as {
    description: string;
    period_index: number | null;
    amount: number;
    waived: boolean;
  }[];

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <Link href="/receipts" className="text-sm text-stone-600 hover:underline">
          ← Back
        </Link>
        <div className="flex items-center gap-3">
          <ReceiptStatus
            invoiceId={invoice.id}
            status={invoice.payment_status}
            paymentMode={invoice.payment_mode}
          />
          <PreviewButton
            url={`/api/receipts/${invoice.id}/pdf`}
            className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            👁 Preview
          </PreviewButton>
          <DownloadButton
            url={`/api/receipts/${invoice.id}/pdf`}
            filename={`${invoice.receipt_no || "receipt"}.pdf`}
            className="rounded-lg bg-stone-900 px-4 py-2 text-sm text-stone-50 hover:bg-stone-800"
          >
            ⤓ Download PDF
          </DownloadButton>
        </div>
      </div>

      <div className="card p-8">
        <header className="flex items-center gap-4 border-b border-stone-200 pb-4 mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/letterhead/aps-logo.jpeg" alt="APS" className="h-16 w-16 rounded-full" />
          <div>
            <h2 className="text-xl font-bold tracking-tight">ADESHWAR PUBLIC SCHOOL</h2>
            <p className="text-xs text-stone-600">
              Affiliated to CISCE Board, New Delhi · Kondagaon, Dist. Kondagaon (C.G.)
            </p>
            <p className="text-xs text-stone-500">
              School Code: CG024 · Mob: 9111005301, 9111005303 · apskondagaon@gmail.com
            </p>
          </div>
        </header>

        <div className="text-center mb-4">
          <div className="text-sm uppercase tracking-wide text-stone-500">Fee Receipt</div>
          <div className="text-lg font-semibold">{invoice.receipt_no}</div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm mb-5">
          <Field label="Student" value={s.full_name} />
          <Field label="Class" value={`${s.classes?.display_name ?? "—"}${s.section ? ` · ${s.section}` : ""}`} />
          <Field label="Father's Name" value={s.father_name ?? "—"} />
          <Field label="Contact" value={s.contact_number ?? "—"} />
          <Field label="Academic Year" value={invoice.academic_year} />
          <Field label="Date" value={formatDate(invoice.issued_at)} />
        </div>

        <table className="w-full text-sm border border-stone-200 mb-4">
          <thead className="bg-stone-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Particulars</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i} className="border-t border-stone-200">
                <td className="px-3 py-2">
                  {it.description}
                  {it.waived && <span className="ml-2 text-amber-600 text-xs">(waived)</span>}
                </td>
                <td className={`px-3 py-2 text-right ${it.waived ? "line-through text-stone-400" : ""}`}>
                  {inr(it.amount)}
                </td>
              </tr>
            ))}
            <tr className="border-t border-stone-200 bg-stone-50">
              <td className="px-3 py-2 text-right">Subtotal</td>
              <td className="px-3 py-2 text-right">{inr(invoice.subtotal)}</td>
            </tr>
            {Number(invoice.waiver_amount) > 0 && (
              <tr>
                <td className="px-3 py-2 text-right">
                  Waiver{invoice.waiver_reason ? ` (${invoice.waiver_reason})` : ""}
                </td>
                <td className="px-3 py-2 text-right">− {inr(invoice.waiver_amount)}</td>
              </tr>
            )}
            <tr>
              <td className="px-3 py-2 text-right">
                Late Fee {invoice.late_fee_waived ? "(waived)" : ""}
              </td>
              <td className="px-3 py-2 text-right">
                {invoice.late_fee_waived ? "₹0" : inr(invoice.late_fee)}
              </td>
            </tr>
            <tr className="border-t border-stone-200 font-semibold">
              <td className="px-3 py-2 text-right">Total Paid</td>
              <td className="px-3 py-2 text-right">{inr(invoice.amount_paid)}</td>
            </tr>
          </tbody>
        </table>

        <div className="text-sm text-stone-600 mb-1">
          Payment Mode: <span className="capitalize">{invoice.payment_mode}</span>
          {invoice.payment_ref ? ` · Ref: ${invoice.payment_ref}` : ""}
        </div>
        {invoice.notes && <div className="text-sm text-stone-600">Notes: {invoice.notes}</div>}
        {invoice.created_by && (
          <div className="text-sm text-stone-600 mt-3">Generated by: {invoice.created_by}</div>
        )}

        <div className="mt-10 flex justify-between text-sm text-stone-600">
          <div>
            <div className="border-t border-stone-400 pt-1 w-40">Signature (Parent)</div>
          </div>
          <div>
            <div className="border-t border-stone-400 pt-1 w-40 text-right">Authorised Signatory</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-stone-500">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
