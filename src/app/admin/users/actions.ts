"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { SCHOOLS } from "@/lib/access";

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
  });

export type ActionState = { error?: string; success?: string } | undefined;

type AdminClient = ReturnType<typeof createAdminClient>;

function isAlreadyRegistered(msg: string): boolean {
  return /already.*registered|already been registered|already exists/i.test(msg);
}

// auth.users has no getByEmail in the JS admin API, so page through it. The
// tenant is small; this is only hit on the rare "already registered" retry.
async function findAuthUserIdByEmail(admin: AdminClient, email: string): Promise<string | null> {
  const wanted = email.toLowerCase();
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data) return null;
    const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === wanted);
    if (hit) return hit.id;
    if (data.users.length < 1000) return null;
  }
  return null;
}

export async function createUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  // New users are created INSIDE the creating admin's group — a Tagore admin
  // can only mint Tagore logins, scoped to Tagore schools. This is the gate
  // that keeps groups from leaking into each other via user creation.
  const me = await requireRole("admin");
  // Demo sandbox is read-mostly: never let a demo visitor mint a real Supabase
  // auth user via the Admin API.
  if (me.is_demo) {
    return { error: "User creation is disabled in the demo." };
  }
  const groupSchoolIds = SCHOOLS.filter((s) => s.groupId === me.group_id).map((s) => s.id);

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
  // Reject any school outside the admin's own group.
  if (!school_ids.every((id) => groupSchoolIds.includes(id))) {
    return { error: "Unknown school id." };
  }
  // Admin/manager are cross-department, so clear any department for them.
  const department = role === "staff" ? parsed.data.department : null;
  // Admin sees every school in their group regardless of what the form said.
  const finalSchoolIds = role === "admin" ? groupSchoolIds : school_ids;

  // Set a synthetic email alongside the phone so sign-in can go through
  // Supabase's email provider (the Phone provider is disabled at the project
  // level). See src/app/actions/auth.ts for the matching login flow.
  const admin = createAdminClient();
  const email = `${phone}@phone.local`;
  const payload = {
    phone,
    email,
    password,
    phone_confirm: true,
    email_confirm: true,
    user_metadata: {
      full_name,
      role,
      department: department ?? "",
      phone,
      school_ids: finalSchoolIds,
      group_id: me.group_id,
    },
  };

  const created = await admin.auth.admin.createUser(payload);
  let userId = created.data?.user?.id ?? null;
  let clearedLeftover = false;

  if (created.error) {
    // auth.users is a single global table (shared across groups). "Already
    // registered" can mean: a real login exists (this or another group), or a
    // leftover ORPHAN auth user with no profile. For an orphan, reclaim it and
    // retry so the admin isn't stuck on an invisible row.
    if (!isAlreadyRegistered(created.error.message)) {
      return { error: created.error.message };
    }
    const { data: existing } = await admin
      .from("profiles")
      .select("id, group_id")
      .or(`phone.eq.${phone},email.eq.${email}`)
      .limit(1);
    const prof = existing?.[0] as { id: string; group_id: string | null } | undefined;
    if (prof) {
      return {
        error:
          prof.group_id === me.group_id
            ? "That phone number already has a login in this group."
            : "That phone number is registered under another franchise.",
      };
    }
    // No profile anywhere → orphaned auth user. Clear it and retry once.
    const orphanId = await findAuthUserIdByEmail(admin, email);
    if (!orphanId) {
      return { error: "That number is already registered but couldn't be located to reset. Contact support." };
    }
    const del = await admin.auth.admin.deleteUser(orphanId);
    if (del.error) {
      return { error: `Couldn't clear a leftover login for that number: ${del.error.message}` };
    }
    const retry = await admin.auth.admin.createUser(payload);
    if (retry.error) return { error: retry.error.message };
    userId = retry.data?.user?.id ?? null;
    clearedLeftover = true;
  }

  if (!userId) return { error: "The login was created but returned no id — check the Users list." };

  // Write the profile EXPLICITLY rather than trusting the handle_new_user DB
  // trigger: on this database that trigger isn't creating profiles, which left
  // every new login as an orphaned auth user (invisible in the admin list).
  // Upsert on id so it's harmless if the trigger *did* fire on another env.
  const { error: profErr } = await admin.from("profiles").upsert(
    {
      id: userId,
      email,
      phone,
      full_name,
      role,
      department,
      school_ids: finalSchoolIds,
      group_id: me.group_id,
      is_active: true,
    },
    { onConflict: "id" },
  );
  if (profErr) {
    return { error: `Login created but profile setup failed: ${profErr.message}` };
  }

  revalidatePath("/admin/users");
  return {
    success: clearedLeftover
      ? `Login created for ${phone} (cleared a leftover account first).`
      : `Login created for ${phone}.`,
  };
}

export async function setUserActive(formData: FormData) {
  const me = await requireRole("admin");
  if (me.is_demo) return;
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!id) return;

  const admin = createAdminClient();
  // Scope the mutation to the caller's group so an admin can't toggle a user
  // in another group by passing their id.
  await admin
    .from("profiles")
    .update({ is_active: active })
    .eq("id", id)
    .eq("group_id", me.group_id);
  revalidatePath("/admin/users");
}

// Hard-delete a login. Delete the AUTH user first: the FK cascade
// (profiles.id -> auth.users.id ON DELETE CASCADE) removes the profile with
// it. Doing it in this order — and checking the error — means a failed delete
// never leaves an orphaned auth user (invisible in the list, but still holding
// the email/phone and blocking re-creation). The old order (profile first,
// auth delete ignored) is exactly what produced those orphans.
export async function deleteUser(formData: FormData) {
  const me = await requireRole("admin");
  if (me.is_demo) return;
  const id = String(formData.get("id") ?? "");
  if (!id || id === me.id) return; // never let admin delete themselves

  const admin = createAdminClient();
  // Verify the target is in the caller's group before the (group-blind) Auth
  // admin delete — otherwise an admin could delete another group's login by id.
  const { data: target } = await admin
    .from("profiles")
    .select("group_id")
    .eq("id", id)
    .maybeSingle();
  if (!target || (target as { group_id: string | null }).group_id !== me.group_id) return;

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) {
    // Don't proceed to remove the profile — leaving both in place keeps the
    // user visible/recoverable instead of orphaning the auth row.
    console.error("[admin/users] deleteUser auth delete failed:", error.message);
    return;
  }
  // Belt-and-braces in case ON DELETE CASCADE isn't configured on this env.
  await admin.from("profiles").delete().eq("id", id).eq("group_id", me.group_id);
  revalidatePath("/admin/users");
}

// Reassign a user's department (staff only — admin/manager are cross-dept
// so we coerce their department to null). Pass department="" to clear.
export async function setUserDepartment(formData: FormData) {
  const me = await requireRole("admin");
  if (me.is_demo) return;
  const id = String(formData.get("id") ?? "");
  const raw = String(formData.get("department") ?? "").trim();
  if (!id) return;

  const dept = raw === "" ? null : raw;
  if (dept !== null && !["fees", "academics", "library", "results"].includes(dept)) {
    return;
  }

  const admin = createAdminClient();
  // Read role to enforce: only staff can have a department; admin/manager
  // are cross-dept and their department must stay null. Scope to the caller's
  // group so another group's user can't be touched by id.
  const { data: profile } = await admin
    .from("profiles")
    .select("role, group_id")
    .eq("id", id)
    .maybeSingle();
  if (!profile || (profile as { group_id: string | null }).group_id !== me.group_id) return;
  const finalDept = profile?.role === "staff" ? dept : null;

  await admin
    .from("profiles")
    .update({ department: finalDept })
    .eq("id", id)
    .eq("group_id", me.group_id);
  revalidatePath("/admin/users");
}
