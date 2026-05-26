import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireDepartment } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/library/students?q=NAME_OR_ADMISSION
// Students matching the query, each with how many books they currently hold.
export async function GET(req: Request) {
  await requireDepartment("library");
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 1) return NextResponse.json({ students: [] });

  const supabase = await createClient();
  const { data: students } = await supabase
    .from("students")
    .select("id, full_name, admission_no, section, classes(display_name)")
    .or(`full_name.ilike.%${q}%,admission_no.ilike.%${q}%`)
    .neq("status", "alumni")
    .order("full_name")
    .limit(15);

  const ids = (students ?? []).map((s) => s.id);
  const counts = new Map<string, number>();
  if (ids.length) {
    const { data: loans } = await supabase
      .from("book_loans")
      .select("student_id")
      .in("student_id", ids)
      .is("returned_at", null);
    for (const l of (loans ?? []) as { student_id: string }[]) {
      counts.set(l.student_id, (counts.get(l.student_id) ?? 0) + 1);
    }
  }

  const result = (students ?? []).map((s) => {
    const klass = (s as unknown as { classes: { display_name?: string } | null }).classes;
    return {
      id: s.id,
      full_name: s.full_name,
      admission_no: s.admission_no,
      class: `${klass?.display_name ?? "—"}${s.section ? ` · ${s.section}` : ""}`,
      openLoans: counts.get(s.id) ?? 0,
    };
  });

  return NextResponse.json({ students: result });
}
