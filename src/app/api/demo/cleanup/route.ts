import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { teardownDemoSchool } from "@/lib/demo-seed";
import { DEMO_TTL_SECONDS } from "@/lib/demo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// TTL sweeper for abandoned demo schools (visitors who never click "Exit demo").
// Scheduled hourly by vercel.json cron. Vercel Cron sends
// `Authorization: Bearer <CRON_SECRET>`; we also accept DEMO_CLEANUP_SECRET for
// manual runs. Uses the service-role client.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const ok =
    (process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`) ||
    (process.env.DEMO_CLEANUP_SECRET && auth === `Bearer ${process.env.DEMO_CLEANUP_SECRET}`);
  if (!ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - DEMO_TTL_SECONDS * 1000).toISOString();

  // Ephemeral demo schools use code `demo-<id8>`; the read-only template is
  // `demo-template` (never swept).
  const { data, error } = await supabase
    .from("schools")
    .select("id, created_at")
    .like("code", "demo-%")
    .neq("code", "demo-template")
    .lt("created_at", cutoff);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let removed = 0;
  for (const s of (data ?? []) as { id: string }[]) {
    try {
      await teardownDemoSchool(supabase, s.id);
      removed++;
    } catch {
      // skip — next sweep retries
    }
  }
  return NextResponse.json({ removed, scanned: (data ?? []).length });
}
