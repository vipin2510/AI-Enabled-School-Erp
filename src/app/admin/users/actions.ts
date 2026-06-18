"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { SCHOOLS } from "@/lib/access";

const VALID_SCHOOL_IDS = SCHOOLS.map((s) => s.id);

const CreateUserSchema = z
  .object({
    phone: z
      .string()
      .regex(/^\d{10}$/, "Phone must be exactly 10 digits."),
    password: z.string().min(6, "Password must be at least 6 characters."),
    full_name: z.string().trim().min(1, "Name is required."),
    role: z.enum(["admin", "manager", "staff"]),
    department: z.enum(["fees", "academics", "library", "results"]).nullable(),
    // Don't use z.string().uuid() — Zod 4 enforces RFC 4122 versioned UUIDs
    // (positions 13 and 17 must be 1-8 / 8-b). The seeded school ids are
    // synthetic (00000000-…-000000000001) and don't satisfy that. The refine
    // below against VALID_SCHOOL_IDS is the real check anyway: it pins the
    // value to the known list, not just to "any UUID".
    school_ids: z.array(z.string().min(1)).min(1, "Select at least one school."),
  })
  .refine((d) => d.role !== "staff" || d.department !== null, {
    message: "Staff must be assigned a department.",
    path: ["department"],
  })
  .refine((d) => d.role !== "staff" || d.school_ids.length === 1, {
    message: "Staff must be assigned to exactly one school.",
    path: ["school_ids"],
  })
  .refine((d) => d.school_ids.every((id) => VALID_SCHOOL_IDS.includes(id)), {
    message: "Unknown school id.",
    path: ["school_ids"],
  });

export type ActionState = { error?: string; success?: string } | undefined;

export async function createUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("admin");

  const rawDept = String(formData.get("department") ?? "");
  const rawSchools = formData.getAll("school_ids").map((v) => String(v)).filter(Boolean);
  const parsed = CreateUserSchema.safeParse({
    phone: String(formData.get("phone") ?? "").replace(/\D/g, ""),
    password: String(formData.get("password") ?? ""),
    full_name: String(formData.get("full_name") ?? ""),
    role: String(formData.get("role") ?? ""),
    department: rawDept === "" ? null : rawDept,
    school_ids: rawSchools,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { phone, password, full_name, role, school_ids } = parsed.data;
  // Admin/manager are cross-department, so clear any department for them.
  const department = role === "staff" ? parsed.data.department : null;
  // Admin always sees every school regardless of what the form said.
  const finalSchoolIds = role === "admin" ? VALID_SCHOOL_IDS : school_ids;

  // Set a synthetic email alongside the phone so sign-in can go through
  // Supabase's email provider (the Phone provider is disabled at the project
  // level). See src/app/actions/auth.ts for the matching login flow.
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    phone,
    email: `${phone}@phone.local`,
    password,
    phone_confirm: true,
    email_confirm: true,
    user_metadata: {
      full_name,
      role,
      department: department ?? "",
      phone,
      school_ids: finalSchoolIds,
    },
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/users");
  return { success: `Login created for ${phone}.` };
}

export async function setUserActive(formData: FormData) {
  await requireRole("admin");
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!id) return;

  const admin = createAdminClient();
  await admin.from("profiles").update({ is_active: active }).eq("id", id);
  revalidatePath("/admin/users");
}

// Hard-delete a login. The on_auth_user_created trigger inserts a profile
// row on signup, but the FK cascade (profiles.id -> auth.users.id ON DELETE
// CASCADE) removes the profile when we delete the auth user. We still nuke
// the profile row explicitly first in case the cascade isn't set up on a
// given environment.
export async function deleteUser(formData: FormData) {
  const me = await requireRole("admin");
  const id = String(formData.get("id") ?? "");
  if (!id || id === me.id) return; // never let admin delete themselves

  const admin = createAdminClient();
  await admin.from("profiles").delete().eq("id", id);
  await admin.auth.admin.deleteUser(id);
  revalidatePath("/admin/users");
}

// Reassign a user's department (staff only — admin/manager are cross-dept
// so we coerce their department to null). Pass department="" to clear.
export async function setUserDepartment(formData: FormData) {
  await requireRole("admin");
  const id = String(formData.get("id") ?? "");
  const raw = String(formData.get("department") ?? "").trim();
  if (!id) return;

  const dept = raw === "" ? null : raw;
  if (dept !== null && !["fees", "academics", "library", "results"].includes(dept)) {
    return;
  }

  const admin = createAdminClient();
  // Read role to enforce: only staff can have a department; admin/manager
  // are cross-dept and their department must stay null.
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", id)
    .maybeSingle();
  const finalDept = profile?.role === "staff" ? dept : null;

  await admin.from("profiles").update({ department: finalDept }).eq("id", id);
  revalidatePath("/admin/users");
}
