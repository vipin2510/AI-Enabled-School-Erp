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
        <CreateUserForm />
      </section>

      <Suspense fallback={<TableSkeleton />}>
        <UsersTable currentUserId={me.id} />
      </Suspense>
    </div>
  );
}

async function UsersTable({ currentUserId }: { currentUserId: string }) {
  let users: ProfileRow[] = [];
  let loadError: string | null = null;

  try {
    const supabase = await createClient();
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

  if (loadError) {
    return (
      <div className="card border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Couldn’t load the existing-users list ({loadError}). You can still
        create a new login above.
      </div>
    );
  }

  return (
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
                {u.id === currentUserId ? (
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
