"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const CreateUserSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(6, "Password must be at least 6 characters."),
    full_name: z.string().trim().min(1, "Name is required."),
    role: z.enum(["admin", "manager", "staff"]),
    department: z.enum(["fees", "academics", "library", "results"]).nullable(),
  })
  .refine((d) => d.role !== "staff" || d.department !== null, {
    message: "Staff must be assigned a department.",
    path: ["department"],
  });

export type ActionState = { error?: string; success?: string } | undefined;

export async function createUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("admin");

  const rawDept = String(formData.get("department") ?? "");
  const parsed = CreateUserSchema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    full_name: String(formData.get("full_name") ?? ""),
    role: String(formData.get("role") ?? ""),
    department: rawDept === "" ? null : rawDept,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { email, password, full_name, role } = parsed.data;
  // Admin/manager are cross-department, so clear any department for them.
  const department = role === "staff" ? parsed.data.department : null;

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role, department: department ?? "" },
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/users");
  return { success: `Login created for ${email}.` };
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
