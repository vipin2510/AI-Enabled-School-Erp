import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { inr, formatDate } from "@/lib/utils";
import { decideExpense } from "./actions";
import SubmitForm from "./submit-form";

export const dynamic = "force-dynamic";

type ExpenseRow = {
  id: string;
  amount: number;
  category: string | null;
  description: string;
  spent_on: string | null;
  status: "pending" | "approved" | "declined";
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
  raised_by: string;
  decided_by: string | null;
};

export default async function ExpensesPage() {
  // Anyone in the fees department lands here. Admin gets the full org-wide
  // log + approve/decline controls; staff/manager see their own log only.
  const profile = await requireDepartment("fees");
  const schoolId = await getCurrentSchoolId(profile);
  const isAdmin = profile.role === "admin";
  const supabase = await createClient();

  let query = supabase
    .from("expenses")
    .select(
      "id, amount, category, description, spent_on, status, decided_at, decision_note, created_at, raised_by, decided_by"
    )
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });
  if (!isAdmin) query = query.eq("raised_by", profile.id);

  const { data: expensesData } = await query;
  const expenses = (expensesData ?? []) as ExpenseRow[];

  // Look up the names of everyone referenced (raisers + deciders) in one go.
  const profileIds = Array.from(
    new Set(
      expenses.flatMap((e) => [e.raised_by, e.decided_by]).filter(Boolean) as string[]
    )
  );
  const { data: profilesData } = profileIds.length
    ? await supabase.from("profiles").select("id, full_name, phone").in("id", profileIds)
    : { data: [] };
  const nameById = new Map(
    ((profilesData ?? []) as { id: string; full_name: string | null; phone: string | null }[]).map(
      (p) => [p.id, p.full_name || p.phone || "—"]
    )
  );

  const pendingCount = expenses.filter((e) => e.status === "pending").length;
  const approvedTotal = expenses
    .filter((e) => e.status === "approved")
    .reduce((s, e) => s + Number(e.amount), 0);
  const declinedCount = expenses.filter((e) => e.status === "declined").length;

  return (
    <div className="max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Expenses</h1>
        <p className="text-stone-500 text-sm">
          {isAdmin
            ? "Approve or decline expenses raised by staff. Decisions are permanent and logged."
            : "Submit a new expense for approval. Track the status of your past requests below."}
        </p>
      </header>

      <section className="card mb-6 p-5">
        <h2 className="mb-3 text-sm font-semibold text-stone-700">Raise a new expense</h2>
        <SubmitForm />
      </section>

      <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tally label="Pending" value={String(pendingCount)} tone="amber" />
        <Tally label="Approved total" value={inr(approvedTotal)} tone="emerald" />
        <Tally label="Declined" value={String(declinedCount)} tone="rose" />
      </section>

      <section className="card overflow-hidden p-0">
        <div className="px-5 py-3">
          <h2 className="text-sm font-semibold text-stone-800">
            {isAdmin ? "All submissions" : "Your submissions"}
          </h2>
          <p className="mt-0.5 text-xs text-stone-500">
            {expenses.length} entries · most recent first
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-5 py-2 font-medium">Submitted</th>
                {isAdmin && <th className="px-3 py-2 font-medium">Raised by</th>}
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Decision</th>
                {isAdmin && <th className="px-5 py-2 text-right font-medium">Action</th>}
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className="border-t border-stone-100 align-top">
                  <td className="px-5 py-2 whitespace-nowrap text-stone-600">
                    {formatDate(e.created_at)}
                    {e.spent_on && e.spent_on !== e.created_at?.slice(0, 10) && (
                      <div className="text-[10px] text-stone-400">
                        spent {formatDate(e.spent_on)}
                      </div>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="px-3 py-2 whitespace-nowrap text-stone-800">
                      {nameById.get(e.raised_by) ?? "—"}
                    </td>
                  )}
                  <td className="px-3 py-2 text-stone-600">{e.category || "—"}</td>
                  <td className="px-3 py-2 text-stone-800">{e.description}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium text-stone-800">
                    {inr(e.amount)}
                  </td>
                  <td className="px-3 py-2">
                    <StatusPill status={e.status} />
                  </td>
                  <td className="px-3 py-2 text-stone-600">
                    {e.decided_at ? (
                      <div className="space-y-0.5">
                        <div className="text-xs text-stone-500">
                          {formatDate(e.decided_at)}
                          {e.decided_by && (
                            <span className="ml-1">
                              · {nameById.get(e.decided_by) ?? "admin"}
                            </span>
                          )}
                        </div>
                        {e.decision_note && (
                          <div className="text-xs text-stone-700">“{e.decision_note}”</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-stone-400">—</span>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="px-5 py-2 text-right">
                      {e.status === "pending" ? (
                        <DecisionForm id={e.id} />
                      ) : (
                        <span className="text-xs text-stone-400">decided</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr>
                  <td
                    colSpan={isAdmin ? 8 : 6}
                    className="px-5 py-10 text-center text-stone-500"
                  >
                    {isAdmin
                      ? "No expenses raised yet."
                      : "You haven’t raised any expenses yet. Use the form above."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatusPill({ status }: { status: "pending" | "approved" | "declined" }) {
  const styles =
    status === "pending"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : status === "approved"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-rose-200 bg-rose-50 text-rose-700";
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${styles}`}
    >
      {status}
    </span>
  );
}

function DecisionForm({ id }: { id: string }) {
  return (
    <form action={decideExpense} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <input
        name="decision_note"
        placeholder="Reason (optional)"
        className="w-44 rounded border border-stone-300 bg-white px-2 py-1 text-xs"
      />
      <div className="flex gap-2">
        <button
          name="decision"
          value="approve"
          className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700"
        >
          Approve
        </button>
        <button
          name="decision"
          value="decline"
          className="rounded bg-rose-600 px-2 py-1 text-xs font-medium text-white hover:bg-rose-700"
        >
          Decline
        </button>
      </div>
    </form>
  );
}

function Tally({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "amber" | "emerald" | "rose";
}) {
  const styles = {
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    rose: "border-rose-200 bg-rose-50 text-rose-900",
  }[tone];
  return (
    <div className={`rounded-lg border px-4 py-3 ${styles}`}>
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
