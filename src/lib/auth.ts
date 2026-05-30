import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  COOKIE_DEPARTMENT,
  COOKIE_SCHOOL,
  SCHOOLS,
  allowedDepartments,
  allowedSchools,
  findSchool,
  isDepartment,
  type Department,
  type Role,
  type School,
  type SchoolId,
} from "@/lib/access";

export type Profile = {
  id: string;
  email: string | null;
  phone: string | null;
  full_name: string | null;
  role: Role;
  department: Department | null;
  school_ids: SchoolId[];
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
    .select("id, email, phone, full_name, role, department, school_ids, is_active")
    .eq("id", user.id)
    .single();

  if (!data || !data.is_active) return null;
  return {
    ...(data as Omit<Profile, "school_ids"> & { school_ids: SchoolId[] | null }),
    school_ids: data.school_ids ?? [],
  } as Profile;
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

// The school the user is currently working in. Staff are pinned to their
// single assigned school; admin/manager read the cookie, validate against the
// schools they can see, and fall back to the first allowed school. Returns
// null if the profile has no school access at all (a configuration bug).
export async function getCurrentSchool(profile: Profile): Promise<School | null> {
  const allowed = allowedSchools(profile.role, profile.school_ids);
  if (allowed.length === 0) return null;

  if (profile.role === "staff") {
    // Staff cannot switch — their school_ids[0] is authoritative even if a
    // stale cookie says otherwise.
    return allowed[0] ?? null;
  }

  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(COOKIE_SCHOOL)?.value;
  const picked = findSchool(fromCookie);
  if (picked && allowed.some((s) => s.id === picked.id)) {
    return picked;
  }
  return null; // leader must pick first via /select-school
}

// Convenience: the active school's id, or redirect L1/L2 to /select-school if
// they haven't picked one yet. Use this in pages/actions that need to filter
// queries by school_id. Staff always have a school (pinned).
export async function requireSchool(profile: Profile): Promise<School> {
  const school = await getCurrentSchool(profile);
  if (school) return school;

  // Staff with no school_ids is a config bug — kick them home with no access.
  if (profile.role === "staff") redirect("/");
  // Leaders: pick a school first.
  redirect("/select-school");
}

export async function getCurrentSchoolId(profile: Profile): Promise<SchoolId> {
  const school = await requireSchool(profile);
  return school.id;
}

// Re-export for convenience so callers only import from one module.
export { SCHOOLS };
