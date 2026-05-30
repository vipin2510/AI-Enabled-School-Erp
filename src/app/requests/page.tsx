import { requireProfile, getCurrentSchoolId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import RequestForm from "./request-form";
import { resolveRequest } from "./actions";

export const dynamic = "force-dynamic";

type RequestRow = {
  id: string;
  requester_email: string | null;
  subject: string;
  body: string;
  status: "open" | "resolved";
  admin_note: string | null;
  created_at: string;
  resolved_at: string | null;
};

export default async function RequestsPage() {
  // Open to every login. Admins resolve; everyone else raises requests.
  const me = await requireProfile();
  const schoolId = await getCurrentSchoolId(me);
  const isAdmin = me.role === "admin";
  const supabase = await createClient();

  // Admin sees every request; everyone else sees only the ones they raised.
  let query = supabase
    .from("change_requests")
    .select("id, requester_email, subject, body, status, admin_note, created_at, resolved_at")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });
  if (!isAdmin) query = query.eq("requested_by", me.id);

  const { data } = await query;
  const requests = (data ?? []) as RequestRow[];

  return (
    <div className="max-w-4xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Change Requests</h1>
        <p className="text-stone-500 text-sm">
          {isAdmin
            ? "Requests raised by managers. Resolve them once handled."
            : "Ask the administrator to make a change you can't do yourself."}
        </p>
      </header>

      <section className="card p-5 mb-8">
        <h2 className="font-medium mb-4">Raise a request</h2>
        <RequestForm />
      </section>

      <section className="space-y-3">
        {requests.map((r) => (
          <div key={r.id} className="card p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.subject}</span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs ${
                      r.status === "open"
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {r.status === "open" ? "Open" : "Resolved"}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-stone-700">{r.body}</p>
                <p className="mt-2 text-xs text-stone-400">
                  {r.requester_email ?? "—"} · {formatDate(r.created_at)}
                </p>
                {r.admin_note && (
                  <p className="mt-2 text-sm text-stone-600">
                    <span className="font-medium">Admin note:</span> {r.admin_note}
                  </p>
                )}
              </div>

              {isAdmin && r.status === "open" && (
                <form action={resolveRequest} className="flex shrink-0 flex-col gap-2 w-56">
                  <input type="hidden" name="id" value={r.id} />
                  <input
                    name="admin_note"
                    placeholder="Note (optional)"
                    className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-xs"
                  />
                  <button className="rounded-lg bg-stone-900 px-3 py-1.5 text-xs text-stone-50">
                    Mark resolved
                  </button>
                </form>
              )}
            </div>
          </div>
        ))}
        {!requests.length && (
          <div className="card p-8 text-center text-stone-500">No requests yet.</div>
        )}
      </section>
    </div>
  );
}
