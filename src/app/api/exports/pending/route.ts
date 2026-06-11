import { createClient } from "@/lib/supabase/server";
import { requireProfile, getCurrentSchoolId } from "@/lib/auth";
import { monthName } from "@/lib/utils";
import { currentAcademicYear } from "@/lib/academic-year";

export const dynamic = "force-dynamic";

// Wrap a CSV cell, escaping quotes. Numbers/strings both welcome.
function csvCell(value: string | number | null | undefined) {
  const s = value == null ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

// GET /api/exports/pending?month=5  → CSV of class-wise students who have NOT
// paid that month's monthly fee, with name + mobile number.
export async function GET(req: Request) {
  const profile = await requireProfile();
  const schoolId = await getCurrentSchoolId(profile);
  const url = new URL(req.url);
  const month = Number(url.searchParams.get("month"));

  if (!month || month < 1 || month > 12) {
    return new Response("Invalid month", { status: 400 });
  }

  const supabase = await createClient();
  const AY = currentAcademicYear();

  const [studentsRes, structRes, paidRes] = await Promise.all([
    supabase
      .from("students")
      .select("id, full_name, contact_number, class_id, classes(display_name, ordinal)")
      .eq("school_id", schoolId)
      .eq("status", "active"),
    supabase
      .from("fee_structures")
      .select("class_id, fee_structure_components(kind, amount)")
      .eq("school_id", schoolId)
      .eq("academic_year", AY)
      .eq("scope", "school"),
    supabase
      .from("invoice_items")
      .select("invoices!inner(student_id, academic_year, payment_status)")
      .eq("school_id", schoolId)
      .eq("kind", "monthly")
      .eq("period_index", month)
      .eq("invoices.academic_year", AY)
      .neq("invoices.payment_status", "void"),
  ]);
  const firstErr = studentsRes.error ?? structRes.error ?? paidRes.error;
  if (firstErr) {
    return new Response(`Export failed: ${firstErr.message}`, { status: 500 });
  }

  type StudentRow = {
    id: string;
    full_name: string;
    contact_number: string | null;
    class_id: string | null;
    classes: { display_name: string; ordinal: number } | null;
  };

  const students = (studentsRes.data ?? []) as unknown as StudentRow[];

  // Monthly fee per class_id (used as the pending amount).
  const monthlyByClass = new Map<string, number>();
  for (const s of (structRes.data ?? []) as unknown as {
    class_id: string | null;
    fee_structure_components: { kind: string; amount: number }[];
  }[]) {
    if (!s.class_id) continue;
    const m = s.fee_structure_components.find((c) => c.kind === "monthly");
    monthlyByClass.set(s.class_id, Number(m?.amount ?? 0));
  }

  const paidSet = new Set(
    ((paidRes.data ?? []) as unknown as { invoices: { student_id: string } }[]).map(
      (r) => r.invoices.student_id
    )
  );

  const pending = students
    .filter((s) => !paidSet.has(s.id))
    .sort((a, b) => {
      const ord = (a.classes?.ordinal ?? 999) - (b.classes?.ordinal ?? 999);
      return ord !== 0 ? ord : a.full_name.localeCompare(b.full_name);
    });

  const header = ["Class", "Student Name", "Mobile Number", "Pending Amount"];
  const lines = [header.map(csvCell).join(",")];
  for (const s of pending) {
    lines.push(
      [
        csvCell(s.classes?.display_name ?? "—"),
        csvCell(s.full_name),
        csvCell(s.contact_number ?? ""),
        csvCell(s.class_id ? monthlyByClass.get(s.class_id) ?? 0 : 0),
      ].join(",")
    );
  }

  // Prepend a UTF-8 BOM so Excel reads names/rupee symbols correctly.
  const csv = "﻿" + lines.join("\r\n") + "\r\n";
  const filename = `pending-fees-${monthName(month)}-${AY}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
