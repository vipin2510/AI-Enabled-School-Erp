/**
 * Backfills synthetic emails (<phone>@phone.local) on auth users that have a
 * phone but no email. Needed because the Supabase Phone provider is disabled
 * in this project — sign-in goes through the email provider via this synthetic
 * address. Idempotent: skips users that already have an email set.
 *
 *   npx tsx scripts/backfill-phone-emails.ts
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  let page = 1;
  let updated = 0;
  let skipped = 0;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      console.error("listUsers failed:", error.message);
      process.exit(1);
    }
    if (data.users.length === 0) break;

    for (const u of data.users) {
      if (!u.phone) continue;
      if (u.email) {
        skipped++;
        continue;
      }
      const email = `${u.phone}@phone.local`;
      const { error: upErr } = await supabase.auth.admin.updateUserById(u.id, {
        email,
        email_confirm: true,
      });
      if (upErr) {
        console.error(`  ! ${u.phone}: ${upErr.message}`);
        continue;
      }
      updated++;
      console.log(`  ✓ ${u.phone} → ${email}`);
    }

    if (data.users.length < 200) break;
    page++;
  }
  console.log(`Done. updated=${updated} skipped=${skipped}`);
}
main();
