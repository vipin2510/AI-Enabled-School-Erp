"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  COOKIE_DEPARTMENT,
  COOKIE_SCHOOL,
  isDepartment,
  allowedDepartments,
  allowedSchools,
  DEPARTMENT_NAV,
} from "@/lib/access";
import { getProfile } from "@/lib/auth";

export type LoginState = { error?: string } | undefined;

// Accept either an email or a 10-digit phone in the same input field, so
// existing email logins keep working while new (phone-based) accounts use
// their number as the username.
function classifyIdentifier(raw: string): { email?: string; phone?: string } | null {
  const v = raw.trim();
  if (!v) return null;
  if (v.includes("@")) return { email: v };
  const digits = v.replace(/\D/g, "");
  if (digits.length === 10) return { phone: digits };
  if (digits.length === 12 && digits.startsWith("91")) return { phone: digits.slice(2) };
  return null;
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const identifierRaw = String(formData.get("identifier") ?? formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/") || "/";

  const id = classifyIdentifier(identifierRaw);
  if (!id || !password) {
    return { error: "Enter your phone number or email and password." };
  }

  const supabase = await createClient();
  const { error } = id.email
    ? await supabase.auth.signInWithPassword({ email: id.email, password })
    : await supabase.auth.signInWithPassword({ phone: id.phone!, password });
  if (error) {
    return { error: "Invalid credentials." };
  }

  // Block deactivated accounts even if their credentials are valid.
  const profile = await getProfile();
  if (!profile) {
    await supabase.auth.signOut();
    return { error: "This account is inactive. Contact your administrator." };
  }

  // Leaders pick a school before landing on a department screen. Staff are
  // pinned to one school by their profile, so they go straight to `next`.
  if ((profile.role === "admin" || profile.role === "manager") && profile.school_ids.length > 1) {
    redirect("/select-school?next=" + encodeURIComponent(next.startsWith("/") ? next : "/"));
  }

  redirect(next.startsWith("/") ? next : "/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// Switch the active department (admin/manager only). Validates against the
// caller's allowed departments before writing the cookie.
export async function setDepartment(formData: FormData) {
  const dept = String(formData.get("department") ?? "");
  const profile = await getProfile();
  if (!profile) redirect("/login");

  if (isDepartment(dept) && allowedDepartments(profile.role, profile.department).includes(dept)) {
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_DEPARTMENT, dept, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    revalidatePath("/", "layout");
    // Land on the new department's first screen so the main content follows
    // the switch instead of leaving the user stranded on the old page.
    redirect(DEPARTMENT_NAV[dept][0]?.href ?? "/");
  }
}

// Switch the active school (admin/manager only — staff are pinned). Validates
// the school id against the schools the profile can see before writing the
// cookie. The `next` form field, if present, controls where the user lands;
// otherwise we go home.
export async function setSchool(formData: FormData) {
  const schoolId = String(formData.get("school_id") ?? "");
  const next = String(formData.get("next") ?? "/") || "/";

  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role === "staff") redirect("/");

  const allowed = allowedSchools(profile.role, profile.school_ids);
  if (!allowed.some((s) => s.id === schoolId)) {
    // Silently ignore an out-of-bounds school — should only happen if the
    // form was tampered with.
    redirect("/select-school");
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_SCHOOL, schoolId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
  redirect(next.startsWith("/") ? next : "/");
}
