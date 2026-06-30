"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAnonClient } from "@/lib/supabase/anon";
import { COOKIE_DEPARTMENT, type Department } from "@/lib/access";
import { DEMO_COOKIE, DEMO_TTL_SECONDS, signDemo, verifyDemo } from "@/lib/demo";
import { currentAcademicYear } from "@/lib/academic-year";
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

  // One round-trip: the Postgres function creates the school row and clones the
  // template's classes/sections/subjects/fee structures/students server-side
  // (see supabase/migrations/0028_demo_rpc.sql) — instead of ~10 sequential
  // inserts from here.
  // Untyped supabase-js client → rpc args type is `never`; cast the payloads.
  const { error } = await supabase.rpc("clone_demo_school", {
    p_school_id: demoSchoolId,
    p_code: code,
    p_academic_year: currentAcademicYear(),
  } as never);
  if (error) {
    // Best-effort cleanup of any partial rows, then bail.
    await supabase.rpc("teardown_demo_school", { p_school_id: demoSchoolId } as never);
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
    // One round-trip server-side teardown (see 0028_demo_rpc.sql).
    await createAnonClient().rpc("teardown_demo_school", { p_school_id: demo.demoSchoolId } as never);
  }
  cookieStore.delete(DEMO_COOKIE);
  redirect("/login");
}
