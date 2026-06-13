import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  ROLE_LABELS,
  DEPARTMENT_LABELS,
  SCHOOLS,
  type Role,
  type Department,
} from "@/lib/access";
import { formatDate } from "@/lib/utils";
import CreateUserForm from "./create-user-form";
import { setUserActive } from "./actions";

export const dynamic = "force-dynamic";

type ProfileRow = {
  id: string;
  email: string | null;
  phone: string | null;
  full_name: string | null;
  role: Role;
  department: Department | null;
  school_ids: string[] | null;
  is_active: boolean;
  created_at: string;
};

const schoolLabel = (id: string) =>
  SCHOOLS.find((s) => s.id === id)?.location.split(",")[0] ?? id.slice(0, 8);

export default async function UsersPage() {
  const me = await requireRole("admin");
  const supabase = await createClient();

  // Wrap the profiles read in try/catch so a Supabase-side blip (network,
  // RLS surprise, project-shared schema change) renders a warm warning
  // instead of crashing the whole page. Server-side console.error lands in
  // Vercel logs with the request id so the actual cause is recoverable.
  let users: ProfileRow[] = [];
  let loadError: string | null = null;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, email, phone, full_name, role, department, school_ids, is_active, created_at",
      )
      .order("created_at", { ascending: true });
    if (error) {
      loadError = error.message;
      console.error("[admin/users] profiles SELECT error:", error);
    } else {
      users = (data ?? []) as ProfileRow[];
    }
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Failed to load existing users.";
    console.error("[admin/users] profiles SELECT threw:", e);
  }

  return (
    <div className="max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Users &amp; Logins</h1>
        <p className="text-stone-500 text-sm">
          Create login credentials and manage access. Only admins can do this.
        </p>
      </header>

      <section className="card p-5 mb-8">
        <h2 className="font-medium mb-4">Create a new login</h2>
        <CreateUserForm />
      </section>

      {loadError && (
        <div className="card mb-6 border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Couldn’t load the existing-users list ({loadError}). You can still
          create a new login above.
        </div>
      )}

      <section className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-stone-500 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Login</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">Department</th>
              <th className="px-4 py-2 font-medium">Schools</th>
              <th className="px-4 py-2 font-medium">Created</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-stone-100">
                <td className="px-4 py-2 font-medium">{u.full_name || "—"}</td>
                <td className="px-4 py-2 text-stone-600">{u.phone || u.email || "—"}</td>
                <td className="px-4 py-2">{ROLE_LABELS[u.role] ?? u.role ?? "—"}</td>
                <td className="px-4 py-2">
                  {u.department ? (DEPARTMENT_LABELS[u.department] ?? u.department) : "—"}
                </td>
                <td className="px-4 py-2 text-stone-600">
                  {u.role === "admin"
                    ? "All"
                    : (u.school_ids ?? []).map(schoolLabel).join(", ") || "—"}
                </td>
                <td className="px-4 py-2 text-stone-500">{formatDate(u.created_at)}</td>
                <td className="px-4 py-2">
                  {u.is_active ? (
                    <span className="text-emerald-700">Active</span>
                  ) : (
                    <span className="text-stone-400">Inactive</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  {u.id === me.id ? (
                    <span className="text-xs text-stone-400">You</span>
                  ) : (
                    <form action={setUserActive}>
                      <input type="hidden" name="id" value={u.id} />
                      <input type="hidden" name="active" value={u.is_active ? "false" : "true"} />
                      <button className="text-stone-900 hover:underline">
                        {u.is_active ? "Deactivate" : "Reactivate"}
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {!users.length && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-stone-500">
                  No users yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
