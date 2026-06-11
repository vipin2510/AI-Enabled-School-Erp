import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// A cookie-less server client. Use ONLY inside `unstable_cache` callbacks —
// those run outside request scope, so the cookie-bearing client from
// `./server.ts` can't be used there. The queries cached this way must always
// be tenant-scoped via explicit `.eq("school_id", ...)` filters; nothing here
// implicitly knows about the caller's session.
//
// RLS is currently permissive (see CLAUDE.md), so this client and the
// per-request one see the same rows; the only difference is that this one
// doesn't try to refresh the user session.
let _client: ReturnType<typeof createSupabaseClient> | null = null;

export function createAnonClient() {
  if (_client) return _client;
  _client = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return _client;
}
