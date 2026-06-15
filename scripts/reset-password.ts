/**
 * Resets a user's password via the Supabase Auth admin API.
 *
 *   npx tsx scripts/reset-password.ts <email-or-10-digit-phone> <new-password>
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });
config();

const [, , identifier, password] = process.argv;

if (!identifier || !password) {
  console.error(
    "Usage: npx tsx scripts/reset-password.ts <email-or-10-digit-phone> <new-password>"
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

function classify(raw: string): { email?: string; phone?: string } {
  if (raw.includes("@")) return { email: raw };
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return { phone: digits };
  if (digits.length === 12 && digits.startsWith("91")) return { phone: digits.slice(2) };
  throw new Error("Identifier must be an email or a 10-digit phone number.");
}

async function main() {
  const id = classify(identifier);

  const { data: list, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) {
    console.error("Failed to list users:", listErr.message);
    process.exit(1);
  }

  const user = list.users.find((u) =>
    id.email ? u.email === id.email : u.phone === id.phone
  );

  if (!user) {
    console.error(`No auth user found for ${identifier}.`);
    process.exit(1);
  }

  const { error } = await supabase.auth.admin.updateUserById(user.id, { password });
  if (error) {
    console.error("Failed:", error.message);
    process.exit(1);
  }

  console.log(`Password reset for ${identifier} (auth id ${user.id}).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
