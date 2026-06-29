import { createClient } from "@/lib/supabase/server";
import { requireRole, getCurrentSchoolId } from "@/lib/auth";
import { ROLE_LABELS, type Role } from "@/lib/access";

export const dynamic = "force-dynamic";

// Wrap a CSV cell, escaping quotes. Numbers/strings both welcome.
function csvCell(value: string | number | null | undefined) {
  const s = value == null ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 19).replace("T", " ");
}

// GET /api/admin/staff-attendance-export?from=YYYY-MM-DD&to=YYYY-MM-DD&profile_id=UUID
// All params are optional. profile_id, if present, narrows to one staffer
// so the per-profile "Export" link only ships their rows. Admin only.
export async function GET(req: Request) {
  const profile = await requireRole("admin");
  const schoolId = await getCurrentSchoolId(profile);
  const url = new URL(req.url);
  const from = url.searchParams.get("from") || null;
  const to = url.searchParams.get("to") || null;
  const profileId = url.searchParams.get("profile_id") || null;

  const supabase = await createClient();

  const [{ data: staff }, marksRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, phone, role")
      .eq("group_id", profile.group_id)
      .in("role", ["manager", "staff"])
      .order("full_name"),
    (() => {
      let q = supabase
        .from("staff_attendance")
        .select("profile_id, date, marked_at, latitude, longitude")
        .eq("school_id", schoolId)
        .order("date", { ascending: false })
        .order("marked_at", { ascending: false });
      if (from) q = q.gte("date", from);
      if (to) q = q.lte("date", to);
      if (profileId) q = q.eq("profile_id", profileId);
      return q;
    })(),
  ]);

  if (marksRes.error) return new Response(marksRes.error.message, { status: 500 });

  const staffById = new Map(
    (staff ?? []).map((s) => [
      s.id,
      s as { id: string; full_name: string | null; email: string | null; phone: string | null; role: Role },
    ])
  );

  const header = [
    "Date",
    "Marked at",
    "Staff name",
    "Role",
    "Phone",
    "Email",
    "Latitude",
    "Longitude",
    "Maps link",
  ];

  const rows = (marksRes.data ?? []).map((m) => {
    const s = staffById.get(m.profile_id);
    const mapsLink =
      m.latitude != null && m.longitude != null
        ? `https://www.google.com/maps?q=${m.latitude},${m.longitude}`
        : "";
    return [
      m.date,
      formatDateTime(m.marked_at),
      s?.full_name ?? "",
      s ? ROLE_LABELS[s.role] ?? s.role : "",
      s?.phone ?? "",
      s?.email ?? "",
      m.latitude ?? "",
      m.longitude ?? "",
      mapsLink,
    ];
  });

  // UTF-8 BOM so Excel handles names/specials cleanly.
  const csv =
    "﻿" +
    [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");

  const filename = `staff-attendance${from || to ? `-${from ?? "start"}_${to ?? "today"}` : "-all"}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
