/**
 * Creates (or promotes) a Layer-1 admin login. Run once to bootstrap, since
 * only an admin can create other logins from inside the app.
 *
 *   npx tsx scripts/create-admin.ts <email> <password> ["Full Name"]
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Load .env.local first (Next's convention), then fall back to .env.
config({ path: ".env.local" });
config();

const [, , email, password, fullName] = process.argv;

if (!email || !password) {
  console.error('Usage: npx tsx scripts/create-admin.ts <email> <password> ["Full Name"]');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // Create the auth user with admin role baked into metadata so the
  // handle_new_user trigger writes the right profile.
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName ?? "Administrator", role: "admin" },
  });

  if (error) {
    // Already exists? Promote the existing profile to admin instead.
    if (error.message.toLowerCase().includes("already")) {
      const { data: list } = await supabase.auth.admin.listUsers();
      const existing = list.users.find((u) => u.email === email);
      if (existing) {
        await supabase
          .from("profiles")
          .update({ role: "admin", is_active: true, department: null })
          .eq("id", existing.id);
        console.log(`Existing user ${email} promoted to admin.`);
        return;
      }
    }
    console.error("Failed:", error.message);
    process.exit(1);
  }

  // Ensure the profile is admin (in case the trigger isn't installed yet).
  if (data.user) {
    await supabase
      .from("profiles")
      .upsert(
        {
          id: data.user.id,
          email,
          full_name: fullName ?? "Administrator",
          role: "admin",
          department: null,
          is_active: true,
        },
        { onConflict: "id" }
      );
  }

  console.log(`Admin created: ${email}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
