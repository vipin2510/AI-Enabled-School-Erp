import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  COOKIE_DEPARTMENT,
  allowedDepartments,
  isDepartment,
  type Department,
  type Role,
} from "@/lib/access";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
  department: Department | null;
  is_active: boolean;
};

// The signed-in user's profile, or null. Memoized per render pass so multiple
// callers in one request hit the DB once.
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, department, is_active")
    .eq("id", user.id)
    .single();

  if (!data || !data.is_active) return null;
  return data as Profile;
});

// Use in pages/actions that require a logged-in user. Redirects to /login.
export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return profile;
}

// Use in admin-only pages/actions.
export async function requireRole(...roles: Role[]): Promise<Profile> {
  const profile = await requireProfile();
  if (!roles.includes(profile.role)) redirect("/");
  return profile;
}

// Gate a department-specific page. Admin/manager pass; staff must belong to the
// department. Anyone else is sent home.
export async function requireDepartment(department: Department): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role === "admin" || profile.role === "manager") return profile;
  if (profile.department === department) return profile;
  redirect("/");
}

// The department the user is currently working in. Staff are pinned to their
// own department; admin/manager fall back to the cookie, then to "fees".
export async function getCurrentDepartment(profile: Profile): Promise<Department> {
  const allowed = allowedDepartments(profile.role, profile.department);
  if (profile.role === "staff") {
    return profile.department ?? allowed[0] ?? "fees";
  }
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(COOKIE_DEPARTMENT)?.value;
  if (isDepartment(fromCookie) && allowed.includes(fromCookie)) {
    return fromCookie;
  }
  return allowed[0] ?? "fees";
}
