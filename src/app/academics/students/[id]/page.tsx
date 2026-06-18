import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { inr, formatDate } from "@/lib/utils";
import { todayStr } from "@/lib/attendance";
import { currentAcademicYear } from "@/lib/academic-year";
import ProfilePhotos from "@/components/profile-photos";
import { DownloadButton } from "@/components/ui/download-button";
import { toggleBusFeeMonth, setBusFeeAmount } from "../actions";

export const dynamic = "force-dynamic";

export default async function StudentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireDepartment("academics");
  const schoolId = await getCurrentSchoolId(profile);
  const { id } = await params;
  const supabase = await createClient();

  const { data: student } = await supabase
    .from("students")
    .select(
      "id, full_name, admission_no, section, gender, blood_group, date_of_birth, father_name, father_mobile, mother_name, mother_mobile, contact_number, alt_contact, address, is_hosteller, is_new_admission, status, student_photo_url, parent_photo_url, bus_fee_amount, classes(display_name)"
    )
    .eq("school_id", schoolId)
    .eq("id", id)
    .single();

  if (!student) notFound();

  const academicYear = currentAcademicYear();
  const { data: busFeeRows } = await supabase
    .from("student_bus_fee_months")
    .select("month_index")
    .eq("school_id", schoolId)
    .eq("student_id", id)
    .eq("academic_year", academicYear);
  const paidMonths = new Set(
    ((busFeeRows ?? []) as { month_index: number }[]).map((r) => r.month_index)
  );
  // School-year order: Apr (4) → Mar (3) wrapping through the year.
  const SCHOOL_YEAR_MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
  const MONTH_SHORT = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const busFeeMonthly = Number(student.bus_fee_amount ?? 0);
  const paidCount = paidMonths.size;
  const busFeePaid = paidCount * busFeeMonthly;
  const busFeeDue = (12 - paidCount) * busFeeMonthly;

  const klass = (student as unknown as { classes: { display_name?: string } | null }).classes;

  const [{ data: invoices }, { data: attendance }, { data: loans }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, receipt_no, issued_at, academic_year, total, amount_paid, payment_status, payment_mode")
      .eq("school_id", schoolId)
      .eq("student_id", id)
      .order("issued_at", { ascending: false }),
    supabase
      .from("attendance")
      .select("status")
      .eq("school_id", schoolId)
      .eq("student_id", id),
    supabase
      .from("book_loans")
      .select("id, issued_at, due_date, returned_at, books(title, code)")
      .eq("school_id", schoolId)
      .eq("student_id", id)
      .order("issued_at", { ascending: false }),
  ]);

  const totalPaid = (invoices ?? [])
    .filter((i) => i.payment_status !== "void")
    .reduce((s, i) => s + Number(i.amount_paid || 0), 0);

  const attRows = (attendance ?? []) as { status: string }[];
  const daysMarked = attRows.length;
  const daysPresent = attRows.filter((a) => a.status === "present").length;
  const attendancePct = daysMarked ? Math.round((daysPresent / daysMarked) * 100) : 0;

  type Loan = {
    id: string;
    issued_at: string;
    due_date: string | null;
    returned_at: string | null;
    books: { title: string; code: string } | null;
  };
  const loanRows = (loans ?? []) as unknown as Loan[];
  const totalBorrowed = loanRows.length;
  const totalReturned = loanRows.filter((l) => l.returned_at).length;
  const currentlyHeld = loanRows.filter((l) => !l.returned_at).length;
  const today = todayStr();

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
              <Detail label="Father's Mobile" value={student.father_mobile} />
              <Detail label="Mother's Name" value={student.mother_name} />
              <Detail label="Mother's Mobile" value={student.mother_mobile} />
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

          {busFeeMonthly > 0 ? (
            <div className="card p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-stone-800">
                  Bus Fee · AY {academicYear}
                </h2>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <form action={setBusFeeAmount} className="flex items-center gap-1">
                    <input type="hidden" name="student_id" value={student.id} />
                    <span className="text-stone-500">₹</span>
                    <input
                      name="bus_fee_amount"
                      type="number"
                      min={0}
                      step={1}
                      defaultValue={busFeeMonthly}
                      className="w-20 rounded border border-stone-300 bg-white px-2 py-0.5 text-xs"
                      aria-label="Monthly bus fee amount"
                    />
                    <button className="rounded bg-stone-900 px-2 py-0.5 text-xs text-stone-50 hover:bg-stone-700">
                      Save
                    </button>
                  </form>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                    Paid {inr(busFeePaid)} ({paidCount}/12)
                  </span>
                  {busFeeDue > 0 && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700">
                      Due {inr(busFeeDue)}
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-6 gap-2 sm:grid-cols-12">
                {SCHOOL_YEAR_MONTHS.map((m) => {
                  const paid = paidMonths.has(m);
                  return (
                    <form
                      key={m}
                      action={toggleBusFeeMonth}
                      className="contents"
                    >
                      <input type="hidden" name="student_id" value={student.id} />
                      <input type="hidden" name="academic_year" value={academicYear} />
                      <input type="hidden" name="month_index" value={m} />
                      <input
                        type="hidden"
                        name="currently_paid"
                        value={paid ? "true" : "false"}
                      />
                      <button
                        type="submit"
                        title={paid ? "Mark unpaid" : "Mark paid"}
                        className={
                          "flex flex-col items-center gap-1 rounded-md border px-1 py-1.5 text-xs transition " +
                          (paid
                            ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                            : "border-stone-200 bg-white text-stone-500 hover:border-stone-400 hover:text-stone-800")
                        }
                      >
                        <span
                          aria-hidden
                          className={
                            "flex h-4 w-4 items-center justify-center rounded border text-[10px] font-bold " +
                            (paid
                              ? "border-emerald-600 bg-emerald-600 text-white"
                              : "border-stone-300 bg-white text-transparent")
                          }
                        >
                          ✓
                        </span>
                        <span className="font-medium">{MONTH_SHORT[m - 1]}</span>
                      </button>
                    </form>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-stone-500">
                Tap a month to toggle bus fee paid / unpaid. Amount is set on the student
                edit form ({inr(busFeeMonthly)} / month).
              </p>
            </div>
          ) : (
            <div className="card p-5">
              <h2 className="mb-2 text-sm font-semibold text-stone-800">Bus Fee</h2>
              <p className="mb-3 text-sm text-stone-500">
                This student is not on the bus. Set a monthly amount below to start
                tracking which months have been paid.
              </p>
              <form action={setBusFeeAmount} className="flex items-center gap-2">
                <input type="hidden" name="student_id" value={student.id} />
                <span className="text-sm text-stone-500">₹</span>
                <input
                  name="bus_fee_amount"
                  type="number"
                  min={0}
                  step={1}
                  placeholder="e.g. 800"
                  className="w-32 rounded border border-stone-300 bg-white px-2 py-1 text-sm"
                  aria-label="Monthly bus fee amount"
                />
                <button className="rounded bg-stone-900 px-3 py-1 text-sm text-stone-50 hover:bg-stone-700">
                  Set monthly amount
                </button>
              </form>
            </div>
          )}

          <div className="card p-5">
            <h2 className="mb-3 text-sm font-semibold text-stone-800">Attendance</h2>
            {daysMarked === 0 ? (
              <p className="text-sm text-stone-500">No attendance recorded yet.</p>
            ) : (
              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <div className="text-2xl font-semibold tracking-tight text-stone-900">
                    {daysPresent}
                    <span className="text-base font-normal text-stone-400"> / {daysMarked} days</span>
                  </div>
                  <div className="text-xs text-stone-500">Days present (of days marked)</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-700">
                    {attendancePct}% present
                  </span>
                  {daysMarked - daysPresent > 0 && (
                    <span className="rounded-full bg-red-50 px-3 py-1 text-sm font-medium text-red-700">
                      {daysMarked - daysPresent} absent
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="card overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
              <h2 className="text-sm font-semibold text-stone-800">Library</h2>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full bg-violet-50 px-3 py-1 font-medium text-violet-700">
                  {totalBorrowed} borrowed all-time
                </span>
                <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
                  {totalReturned} returned
                </span>
                {currentlyHeld > 0 && (
                  <span className="rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-700">
                    {currentlyHeld} not returned
                  </span>
                )}
              </div>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-5 py-2 font-medium">Book</th>
                  <th className="px-3 py-2 font-medium">Issued</th>
                  <th className="px-3 py-2 font-medium">Due</th>
                  <th className="px-3 py-2 font-medium">Returned</th>
                </tr>
              </thead>
              <tbody>
                {loanRows.map((l) => {
                  const overdue = !l.returned_at && l.due_date && l.due_date < today;
                  return (
                    <tr key={l.id} className="border-t border-stone-100">
                      <td className="px-5 py-2">
                        <div className="font-medium text-stone-800">{l.books?.title ?? "—"}</div>
                        {l.books?.code && (
                          <div className="font-mono text-xs text-stone-400">{l.books.code}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-stone-600">{formatDate(l.issued_at)}</td>
                      <td className={"px-3 py-2 " + (overdue ? "font-medium text-red-600" : "text-stone-600")}>
                        {l.due_date ? formatDate(l.due_date) : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {l.returned_at ? (
                          <span className="text-stone-600">{formatDate(l.returned_at)}</span>
                        ) : (
                          <span
                            className={
                              "rounded-full px-2 py-0.5 text-xs font-medium " +
                              (overdue ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700")
                            }
                          >
                            {overdue ? "Overdue" : "Out"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!loanRows.length && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-stone-500">
                      No books borrowed yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
