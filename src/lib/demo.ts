// Demo-mode kernel. Everything that makes the public "See Demo" sandbox work
// lives here so the branches in auth.ts / proxy.ts stay one-liners.
//
// A demo visitor has NO Supabase auth user. Instead they carry a signed
// `erp_demo` cookie naming an ephemeral per-visitor demo school. getProfile()
// turns that cookie into a synthetic admin Profile scoped to that school; every
// existing query already filters by school_id, so the visitor is fully confined
// to their own ephemeral tenant. RLS is permissive, so the anon client can
// read/write that school's rows without a real session.
//
// The cookie is HMAC-signed (Web Crypto — this module is imported by the Edge
// proxy, so no Node `crypto`) to stop a visitor forging another school_id.

import { DEMO_GROUP_ID, type School } from "@/lib/access";
import type { Profile } from "@/lib/auth";

export const DEMO_COOKIE = "erp_demo";

// Lifetime of a demo session/school. Cookie maxAge + the TTL the cleanup
// sweeper uses to reap abandoned demo schools.
export const DEMO_TTL_SECONDS = 2 * 60 * 60; // 2 hours

// Fixed ids that are never inserted into auth.users / profiles. The profile id
// is only used as a synthetic marker + `created_by` fallback paths.
export const DEMO_PROFILE_ID = "00000000-0000-0000-0000-0000000000de";

// The read-only template school the per-visitor school is cloned from. Seeded
// once by supabase/migrations/0027_demo_template.sql. Its id is NEVER put in a
// cookie, so visitors can't write to it.
export const TEMPLATE_SCHOOL_ID = "00000000-0000-0000-0000-0000000000d0";

export type DemoProfile = Profile & { is_demo: true };

// A synthetic School for the ephemeral demo school id (absent from the static
// SCHOOLS array). Drives the shell + receipt branding.
export function makeDemoSchool(demoSchoolId: string): School {
  return {
    id: demoSchoolId,
    groupId: DEMO_GROUP_ID,
    code: "demo",
    name: "Demo Public School",
    location: "Demo City, India",
    addressLine: "123 Demo Road, Demo City",
    pinCode: "000000",
    mobile: "9000000000",
    email: "demo@example.com",
    board: "Demo Board",
    boardCode: "DEMO",
  };
}

// The synthetic admin profile a valid demo cookie maps to.
export function makeDemoProfile(demoSchoolId: string): DemoProfile {
  return {
    id: DEMO_PROFILE_ID,
    email: null,
    phone: null,
    full_name: "Demo Admin",
    role: "admin",
    department: null,
    school_ids: [demoSchoolId],
    group_id: DEMO_GROUP_ID,
    is_active: true,
    is_demo: true,
  };
}

// ---- Signed cookie -------------------------------------------------------

type DemoPayload = { demoSchoolId: string; exp: number };

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function secret(): string {
  const s = process.env.DEMO_COOKIE_SECRET;
  if (!s) throw new Error("DEMO_COOKIE_SECRET is not set");
  return s;
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

// Constant-time-ish compare on equal-length byte arrays.
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function signDemo(demoSchoolId: string): Promise<string> {
  const payload: DemoPayload = {
    demoSchoolId,
    exp: Math.floor(Date.now() / 1000) + DEMO_TTL_SECONDS,
  };
  const body = b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const sigBuf = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(),
    new TextEncoder().encode(body),
  );
  const sig = b64urlEncode(new Uint8Array(sigBuf));
  return `${body}.${sig}`;
}

// Verify the cookie value and return the (unexpired) payload, or null.
export async function verifyDemo(
  value: string | undefined | null,
): Promise<DemoPayload | null> {
  if (!value || !value.includes(".")) return null;
  try {
    const [body, sig] = value.split(".");
    const expected = await crypto.subtle.sign(
      "HMAC",
      await hmacKey(),
      new TextEncoder().encode(body),
    );
    if (!timingSafeEqual(b64urlDecode(sig), new Uint8Array(expected))) return null;
    const payload = JSON.parse(
      new TextDecoder().decode(b64urlDecode(body)),
    ) as DemoPayload;
    if (typeof payload.demoSchoolId !== "string" || typeof payload.exp !== "number") {
      return null;
    }
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
