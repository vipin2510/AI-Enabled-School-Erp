import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAnonClient } from "@/lib/supabase/anon";
import { cached } from "@/lib/cache/index";
import { DEMO_COOKIE, verifyDemo, makeDemoProfile, makeDemoSchool } from "@/lib/demo";
import {
  COOKIE_DEPARTMENT,
  COOKIE_SCHOOL,
  SCHOOLS,
  DEFAULT_GROUP_ID,
  allowedDepartments,
  allowedSchools,
  findGroup,
  findSchool,
  isDepartment,
  type Department,
  type Group,
  type GroupId,
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
  group_id: GroupId;
  is_active: boolean;
  // True only for the synthetic profile minted from a valid `erp_demo` cookie
  // (public "See Demo" sandbox). Never set on a real DB-backed profile.
  is_demo?: boolean;
};

// Pull the profile row for a known user id. Cached for 60s in the local store
// keyed by user.id — so the profiles SELECT runs once per minute per user
// (across all their nav clicks), not once per click. Mutations to the
// profile row should bust `profile:<id>` if read-your-own-writes matter
// (today the admin user editor doesn't, role/department changes propagate
// within the TTL).
async function loadProfileById(userId: string): Promise<Profile | null> {
  return cached(`profile:${userId}`, [`profile:${userId}`], 60, async () => {
    // Cookie-less client — `cached()` callbacks must not depend on request
    // scope; RLS is permissive so a school-scoped row read here is fine.
    const anon = createAnonClient();
    const { data } = await anon
      .from("profiles")
      .select("id, email, phone, full_name, role, department, school_ids, group_id, is_active")
      .eq("id", userId)
      .single();
    if (!data) return null;
    const row = data as Omit<Profile, "school_ids" | "group_id"> & {
      school_ids: SchoolId[] | null;
      group_id: GroupId | null;
    };
    if (!row.is_active) return null;
    return {
      ...row,
      school_ids: row.school_ids ?? [],
      group_id: row.group_id ?? DEFAULT_GROUP_ID,
    } as Profile;
  });
}

// The signed-in user's profile, or null. Memoized per render pass (React
// `cache()`) so the auth call only runs once per request, and the DB row
// behind it is in the local LRU so subsequent requests within the TTL skip
// it entirely.
//
// Any auth failure here is treated as "logged out" rather than rethrown.
// The Supabase SDK throws AuthApiError when the refresh token is invalid
// (a routine condition: parallel tabs, post-deploy session resets, multi-
// device logins). Letting that propagate would crash the page render and
// trigger the route error boundary, which is wrong for what is just a
// stale session — requireProfile() handles null by redirecting to /login,
// which is the correct outcome. The proxy still clears the bad cookies
// on the next request so the user doesn't loop.
export const getProfile = cache(async (): Promise<Profile | null> => {
  try {
    // Demo sandbox: a valid `erp_demo` cookie short-circuits Supabase auth and
    // the 60s profile cache, returning a synthetic admin scoped to the
    // visitor's ephemeral demo school. Checked first so a demo visitor needs no
    // sb-* session at all.
    const cookieStore = await cookies();
    const demo = await verifyDemo(cookieStore.get(DEMO_COOKIE)?.value);
    if (demo) return makeDemoProfile(demo.demoSchoolId);

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    return await loadProfileById(user.id);
  } catch {
    return null;
  }
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
  // Demo: the ephemeral school isn't in the static SCHOOLS array, so synthesize
  // it from the profile (set from the signed cookie). Must come first — it has
  // no cookie to pick and must not bounce to /select-school.
  if (profile.is_demo) return makeDemoSchool(profile.school_ids[0]);

  const allowed = allowedSchools(profile.role, profile.school_ids, profile.group_id);
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

// The group (franchise) the profile belongs to — drives branding (logo, name)
// across the shell and PDFs. Falls back to the default group if unset.
export function getCurrentGroup(profile: Profile): Group {
  return findGroup(profile.group_id) ?? findGroup(DEFAULT_GROUP_ID)!;
}

// Re-export for convenience so callers only import from one module.
export { SCHOOLS };
