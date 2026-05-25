"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { COOKIE_DEPARTMENT, isDepartment, allowedDepartments } from "@/lib/access";
import { getProfile } from "@/lib/auth";

export type LoginState = { error?: string } | undefined;

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/") || "/";

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "Invalid email or password." };
  }

  // Block deactivated accounts even if their credentials are valid.
  const profile = await getProfile();
  if (!profile) {
    await supabase.auth.signOut();
    return { error: "This account is inactive. Contact your administrator." };
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
  }
}
