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
    school_ids: z.array(z.string().uuid()).min(1, "Select at least one school."),
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

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    phone,
    password,
    phone_confirm: true,
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
