"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAnonClient } from "@/lib/supabase/anon";
import { DEMO_GROUP_ID, COOKIE_DEPARTMENT, type Department } from "@/lib/access";
import { DEMO_COOKIE, DEMO_TTL_SECONDS, signDemo, verifyDemo } from "@/lib/demo";
import { cloneTemplateSchool, teardownDemoSchool } from "@/lib/demo-seed";
import { isPhone } from "@/lib/device";

// Basic per-instance, per-IP rate limit so a script can't mass-create demo
// schools. Best-effort (serverless memory isn't shared across instances); the
// TTL sweeper bounds the worst case regardless.
const RATE_LIMIT = 6; // starts allowed...
const RATE_WINDOW_MS = 10 * 60 * 1000; // ...per 10 minutes per IP
const starts = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (starts.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  hits.push(now);
  starts.set(ip, hits);
  return hits.length > RATE_LIMIT;
}

export async function startDemo(): Promise<void> {
  const hdrs = await headers();
  const ip = (hdrs.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  if (rateLimited(ip)) {
    redirect("/login?reason=demo_busy");
  }

  const supabase = createAnonClient();
  const demoSchoolId = crypto.randomUUID();
  const code = `demo-${demoSchoolId.slice(0, 8)}`;

  // The schools row must exist before any child rows (FK target).
  const schoolRow: Record<string, unknown> = {
    id: demoSchoolId,
    group_id: DEMO_GROUP_ID,
    code,
    name: "Demo Public School",
    location: "Demo City, India",
    board: "Demo Board",
    board_code: "DEMO",
    is_active: true,
    sort_order: 99,
  };
  // Untyped supabase-js client → insert row type is `never`; cast the payload.
  const { error: schoolErr } = await supabase.from("schools").insert(schoolRow as never);
  if (schoolErr) {
    redirect("/login?reason=demo_failed");
  }

  try {
    await cloneTemplateSchool(supabase, demoSchoolId);
  } catch {
    // Roll back the partially-created demo school so we don't leak rows.
    await teardownDemoSchool(supabase, demoSchoolId).catch(() => {});
    redirect("/login?reason=demo_failed");
  }

  const cookieStore = await cookies();
  cookieStore.set(DEMO_COOKIE, await signDemo(demoSchoolId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: DEMO_TTL_SECONDS,
  });

  // A real phone has no laptop option → go straight to the full-screen app.
  // Desktop/tablet → the /demo selection page (laptop + mobile live previews).
  const realPhone = isPhone(hdrs.get("user-agent"));
  redirect(realPhone ? "/" : "/demo");
}

// Tour navigation: switch the active department (erp_dept cookie) and land on a
// module page. Mirrors setDepartment but takes an explicit href so the tour can
// target a module's dashboard. No-ops outside a demo session.
export async function goToDemoStop(dept: Department, href: string): Promise<void> {
  const cookieStore = await cookies();
  const demo = await verifyDemo(cookieStore.get(DEMO_COOKIE)?.value);
  if (!demo) return;
  cookieStore.set(COOKIE_DEPARTMENT, dept, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
  redirect(href);
}

export async function exitDemo(): Promise<void> {
  const cookieStore = await cookies();
  const demo = await verifyDemo(cookieStore.get(DEMO_COOKIE)?.value);
  if (demo) {
    await teardownDemoSchool(createAnonClient(), demo.demoSchoolId).catch(() => {});
  }
  cookieStore.delete(DEMO_COOKIE);
  redirect("/login");
}
