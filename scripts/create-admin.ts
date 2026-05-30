/**
 * Creates (or promotes) a Layer-1 admin login. Run once to bootstrap, since
 * only an admin can create other logins from inside the app.
 *
 *   npx tsx scripts/create-admin.ts <identifier> <password> ["Full Name"]
 *
 * Where <identifier> is either:
 *   - an email   (e.g. principal@example.com), or
 *   - a 10-digit phone number (e.g. 9876543210).
 *
 * Admin profiles get school_ids = all three franchise schools.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });
config();

const [, , identifier, password, fullName] = process.argv;

if (!identifier || !password) {
  console.error(
    'Usage: npx tsx scripts/create-admin.ts <email-or-10-digit-phone> <password> ["Full Name"]'
  );
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

// Match the SCHOOLS constant in src/lib/access.ts.
const ALL_SCHOOLS = [
  "00000000-0000-0000-0000-000000000001",
  "00000000-0000-0000-0000-000000000002",
  "00000000-0000-0000-0000-000000000003",
];

function classify(raw: string): { email?: string; phone?: string } {
  if (raw.includes("@")) return { email: raw };
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return { phone: digits };
  if (digits.length === 12 && digits.startsWith("91")) return { phone: digits.slice(2) };
  throw new Error("Identifier must be an email or a 10-digit phone number.");
}

async function main() {
  const id = classify(identifier);

  const createPayload = id.email
    ? {
        email: id.email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName ?? "Administrator",
          role: "admin",
          school_ids: ALL_SCHOOLS,
        },
      }
    : {
        phone: id.phone!,
        password,
        phone_confirm: true,
        user_metadata: {
          full_name: fullName ?? "Administrator",
          role: "admin",
          phone: id.phone!,
          school_ids: ALL_SCHOOLS,
        },
      };

  const { data, error } = await supabase.auth.admin.createUser(createPayload);

  if (error) {
    if (error.message.toLowerCase().includes("already")) {
      // Already exists — promote the matching profile to admin with all schools.
      const { data: list } = await supabase.auth.admin.listUsers();
      const existing = list.users.find((u) =>
        id.email ? u.email === id.email : u.phone === id.phone
      );
      if (existing) {
        await supabase
          .from("profiles")
          .update({
            role: "admin",
            is_active: true,
            department: null,
            school_ids: ALL_SCHOOLS,
            ...(id.phone ? { phone: id.phone } : {}),
          })
          .eq("id", existing.id);
        console.log(`Existing user ${identifier} promoted to admin (all schools).`);
        return;
      }
    }
    console.error("Failed:", error.message);
    process.exit(1);
  }

  if (data.user) {
    await supabase
      .from("profiles")
      .upsert(
        {
          id: data.user.id,
          email: id.email ?? null,
          phone: id.phone ?? null,
          full_name: fullName ?? "Administrator",
          role: "admin",
          department: null,
          school_ids: ALL_SCHOOLS,
          is_active: true,
        },
        { onConflict: "id" }
      );
  }

  console.log(`Admin created: ${identifier}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
