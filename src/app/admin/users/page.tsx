import { Suspense } from "react";
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
import DeleteUserButton from "./delete-user-button";
import { setUserActive, setUserDepartment } from "./actions";

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
  // The Create-User form is the priority: it MUST render even if loading the
  // existing-users list dies. We split that load into a Suspense boundary
  // (UsersTable) so whatever throws inside it can't kill this outer page.
  const me = await requireRole("admin");

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
        {me.is_demo ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Creating logins is disabled in the demo.
          </p>
        ) : (
          <CreateUserForm schools={SCHOOLS.filter((s) => s.groupId === me.group_id)} />
        )}
      </section>

      <Suspense fallback={<TableSkeleton />}>
        <UsersTable currentUserId={me.id} groupId={me.group_id} />
      </Suspense>
    </div>
  );
}

async function UsersTable({ currentUserId, groupId }: { currentUserId: string; groupId: string }) {
  let users: ProfileRow[] = [];
  let loadError: string | null = null;

  try {
    const supabase = await createClient();
    // Scope to the admin's own group so groups never see each other's logins.
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, email, phone, full_name, role, department, school_ids, is_active, created_at",
      )
      .eq("group_id", groupId)
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

  if (loadError) {
    return (
      <div className="card border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Couldn’t load the existing-users list ({loadError}). You can still
        create a new login above.
      </div>
    );
  }

  return (
    <section className="card overflow-x-auto p-0">
      <table className="w-full min-w-[1000px] text-sm">
        <thead className="bg-stone-50 text-stone-500 text-left">
          <tr>
            <th className="px-4 py-2 font-medium">Name</th>
            <th className="px-4 py-2 font-medium">Login</th>
            <th className="px-4 py-2 font-medium">Role</th>
            <th className="px-4 py-2 font-medium">Department</th>
            <th className="px-4 py-2 font-medium">Schools</th>
            <th className="px-4 py-2 font-medium">Created</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 text-right font-medium whitespace-nowrap">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t border-stone-100">
              <td className="px-4 py-2 font-medium">{u.full_name || "—"}</td>
              <td className="px-4 py-2 text-stone-600">{u.phone || u.email || "—"}</td>
              <td className="px-4 py-2">{ROLE_LABELS[u.role] ?? u.role ?? "—"}</td>
              <td className="px-4 py-2">
                {u.role === "staff" && u.id !== currentUserId ? (
                  <form action={setUserDepartment} className="inline-flex items-center gap-1">
                    <input type="hidden" name="id" value={u.id} />
                    <select
                      name="department"
                      defaultValue={u.department ?? ""}
                      className="rounded border border-stone-300 bg-white px-1.5 py-0.5 text-xs"
                      aria-label="Change department"
                    >
                      <option value="">—</option>
                      <option value="fees">Fees</option>
                      <option value="academics">Academics</option>
                      <option value="library">Library</option>
                      <option value="results">Results</option>
                    </select>
                    <button className="text-xs text-stone-500 hover:text-stone-900 hover:underline">
                      Save
                    </button>
                  </form>
                ) : (
                  <span>{u.department ? (DEPARTMENT_LABELS[u.department] ?? u.department) : "—"}</span>
                )}
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
              <td className="px-4 py-2 text-right whitespace-nowrap">
                {u.id === currentUserId ? (
                  <span className="text-xs text-stone-400">You</span>
                ) : (
                  <div className="inline-flex items-center gap-3">
                    <form action={setUserActive}>
                      <input type="hidden" name="id" value={u.id} />
                      <input type="hidden" name="active" value={u.is_active ? "false" : "true"} />
                      <button className="text-xs text-stone-600 hover:text-stone-900 hover:underline">
                        {u.is_active ? "Deactivate" : "Reactivate"}
                      </button>
                    </form>
                    <DeleteUserButton userId={u.id} label={u.full_name || u.phone || u.email || "this user"} />
                  </div>
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
  );
}

function TableSkeleton() {
  return (
    <div className="card p-6">
      <div className="h-4 w-32 rounded-md bg-stone-200/70 animate-pulse" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 rounded-md bg-stone-100 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
