import { createClient as createServiceClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS and can use the Auth admin API
// (create / update / delete users). NEVER import this into client code.
// Requires SUPABASE_SERVICE_ROLE_KEY in the environment.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY (or URL). Add it to .env.local to manage users."
    );
  }
  return createServiceClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
