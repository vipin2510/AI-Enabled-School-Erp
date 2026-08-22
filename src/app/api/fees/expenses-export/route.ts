import { createClient } from "@/lib/supabase/server";
import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";

export const dynamic = "force-dynamic";

function csvCell(value: string | number | null | undefined) {
  const s = value == null ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}
function isoDate(s: string | null) {
  return s ? s.slice(0, 10) : "";
}

// GET /api/fees/expenses-export — CSV of all submissions (admin) or the caller's
// own (staff/manager), mirroring the Expenses page scoping.
export async function GET() {
  const profile = await requireDepartment("fees");
  const schoolId = await getCurrentSchoolId(profile);
  const isAdmin = profile.role === "admin";
  const supabase = await createClient();

  let query = supabase
    .from("expenses")
    .select("amount, category, description, spent_on, status, created_at, decided_at, decision_note, raised_by, decided_by")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });
  if (!isAdmin) query = query.eq("raised_by", profile.id);

  const { data, error } = await query;
  if (error) return new Response(`Export failed: ${error.message}`, { status: 500 });
  const rows = (data ?? []) as {
    amount: number | string; category: string | null; description: string;
    spent_on: string | null; status: string; created_at: string; decided_at: string | null;
    decision_note: string | null; raised_by: string; decided_by: string | null;
  }[];

  const ids = Array.from(new Set(rows.flatMap((r) => [r.raised_by, r.decided_by]).filter(Boolean) as string[]));
  const { data: profs } = ids.length
    ? await supabase.from("profiles").select("id, full_name, phone").in("id", ids)
    : { data: [] };
  const nameById = new Map(
    ((profs ?? []) as { id: string; full_name: string | null; phone: string | null }[]).map(
      (p) => [p.id, p.full_name || p.phone || "—"],
    ),
  );

  const header = ["Submitted", "Spent on", "Raised by", "Category", "Description", "Amount", "Status", "Decided", "Decided by", "Note"];
  const lines = [header.map(csvCell).join(",")];
  for (const r of rows) {
    lines.push(
      [
        isoDate(r.created_at),
        isoDate(r.spent_on),
        nameById.get(r.raised_by) ?? "",
        r.category ?? "",
        r.description,
        Math.round(Number(r.amount) || 0),
        r.status,
        isoDate(r.decided_at),
        r.decided_by ? nameById.get(r.decided_by) ?? "" : "",
        r.decision_note ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  const csv = "﻿" + lines.join("\r\n") + "\r\n";
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="expenses.csv"`,
    },
  });
}
