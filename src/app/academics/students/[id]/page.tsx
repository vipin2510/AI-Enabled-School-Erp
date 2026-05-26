import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { inr, formatDate } from "@/lib/utils";
import ProfilePhotos from "@/components/profile-photos";
import { DownloadButton } from "@/components/ui/download-button";

export const dynamic = "force-dynamic";

export default async function StudentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin", "manager");
  const { id } = await params;
  const supabase = await createClient();

  const { data: student } = await supabase
    .from("students")
    .select(
      "id, full_name, admission_no, section, gender, blood_group, date_of_birth, father_name, mother_name, contact_number, alt_contact, address, is_hosteller, is_new_admission, status, student_photo_url, parent_photo_url, classes(display_name)"
    )
    .eq("id", id)
    .single();

  if (!student) notFound();

  const klass = (student as unknown as { classes: { display_name?: string } | null }).classes;

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, receipt_no, issued_at, academic_year, total, amount_paid, payment_status, payment_mode")
    .eq("student_id", id)
    .order("issued_at", { ascending: false });

  const totalPaid = (invoices ?? [])
    .filter((i) => i.payment_status !== "void")
    .reduce((s, i) => s + Number(i.amount_paid || 0), 0);

  const classLabel = `${klass?.display_name ?? "—"}${student.section ? ` · ${student.section}` : ""}`;

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/academics/students" className="text-sm text-stone-500 hover:underline">
            ← Students
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{student.full_name}</h1>
          <p className="mt-1 text-sm text-stone-500">
            {classLabel}
            {student.admission_no ? ` · Adm. ${student.admission_no}` : ""}
            <span
              className={
                "ml-2 rounded-full px-2 py-0.5 text-xs font-medium capitalize " +
                (student.status === "active"
                  ? "bg-green-50 text-green-700"
                  : "bg-stone-100 text-stone-500")
              }
            >
              {student.status}
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <DownloadButton
            url={`/api/id-cards?studentId=${student.id}`}
            filename={`id-card-${student.full_name.replace(/[^a-z0-9]+/gi, "-")}.pdf`}
            className="rounded-lg border border-stone-200 bg-stone-100 px-4 py-2 text-sm font-medium text-stone-900 hover:bg-stone-200"
          >
            ⤓ ID card
          </DownloadButton>
          <Link
            href={`/academics/students/${student.id}/edit`}
            className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
          >
            Edit
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        {/* Photos (lazy-loaded, click to zoom) */}
        <ProfilePhotos student={student.student_photo_url} parent={student.parent_photo_url} />


        {/* Details */}
        <div className="space-y-6">
          <div className="card p-5">
            <h2 className="mb-3 text-sm font-semibold text-stone-800">Details</h2>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <Detail label="Class & Section" value={classLabel} />
              <Detail label="Admission No." value={student.admission_no} />
              <Detail label="Date of Birth" value={student.date_of_birth ? formatDate(student.date_of_birth) : null} />
              <Detail label="Blood Group" value={student.blood_group} />
              <Detail label="Gender" value={student.gender} />
              <Detail label="Contact" value={student.contact_number} />
              <Detail label="Father's Name" value={student.father_name} />
              <Detail label="Mother's Name" value={student.mother_name} />
              <Detail label="Address" value={student.address} />
              <Detail
                label="Flags"
                value={
                  [student.is_hosteller ? "Hosteller" : null, student.is_new_admission ? "New admission" : null]
                    .filter(Boolean)
                    .join(", ") || "—"
                }
              />
            </dl>
          </div>

          <div className="card overflow-hidden p-0">
            <div className="flex items-center justify-between px-5 py-3">
              <h2 className="text-sm font-semibold text-stone-800">Fee Receipts</h2>
              <span className="text-sm text-stone-500">Total paid: {inr(totalPaid)}</span>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-5 py-2 font-medium">Receipt</th>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Year</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-5 py-2 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {(invoices ?? []).map((inv) => (
                  <tr key={inv.id} className="border-t border-stone-100">
                    <td className="px-5 py-2 font-medium">{inv.receipt_no ?? "—"}</td>
                    <td className="px-3 py-2 text-stone-600">{formatDate(inv.issued_at)}</td>
                    <td className="px-3 py-2 text-stone-600">{inv.academic_year}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{inr(inv.amount_paid)}</td>
                    <td className="px-3 py-2 capitalize text-stone-600">{inv.payment_status}</td>
                    <td className="px-5 py-2 text-right">
                      <Link href={`/receipts/${inv.id}`} className="text-accent hover:underline">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
                {!invoices?.length && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-stone-500">
                      No fee receipts yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-stone-500">{label}</dt>
      <dd className="font-medium text-stone-800">{value || "—"}</dd>
    </div>
  );
}
