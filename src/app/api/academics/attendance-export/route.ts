import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function csvCell(value: string | number | null | undefined) {
  const s = value == null ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

const pad = (n: number) => String(n).padStart(2, "0");

// GET /api/academics/attendance-export?class_id=&section=&month=&year=
// → CSV: one row per student, one column per working date of that month, each
// cell "Present"/"Absent"/"" plus per-student present/absent totals.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const classId = url.searchParams.get("class_id") ?? "";
  const section = url.searchParams.get("section") ?? "";
  const month = Number(url.searchParams.get("month"));
  const year = Number(url.searchParams.get("year"));

  if (!classId || !section) return new Response("Pick a class and section", { status: 400 });
  if (!month || month < 1 || month > 12) return new Response("Invalid month", { status: 400 });
  if (!year || year < 2000 || year > 3000) return new Response("Invalid year", { status: 400 });

  // Working dates of the month (skip Sundays).
  const daysInMonth = new Date(year, month, 0).getDate();
  const dates: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, month - 1, d);
    if (dt.getDay() === 0) continue; // Sunday
    dates.push(`${year}-${pad(month)}-${pad(d)}`);
  }
  const first = `${year}-${pad(month)}-01`;
  const last = `${year}-${pad(month)}-${pad(daysInMonth)}`;

  const supabase = await createClient();
  const [{ data: studs }, { data: klass }, { data: marks }] = await Promise.all([
    supabase
      .from("students")
      .select("id, full_name, admission_no")
      .eq("class_id", classId)
      .eq("section", section)
      .neq("status", "alumni")
      .order("full_name"),
    supabase.from("classes").select("display_name").eq("id", classId).maybeSingle(),
    supabase
      .from("attendance")
      .select("student_id, date, status")
      .eq("class_id", classId)
      .eq("section", section)
      .gte("date", first)
      .lte("date", last),
  ]);

  const students = (studs ?? []) as { id: string; full_name: string; admission_no: string | null }[];
  const byStudentDate = new Map<string, "present" | "absent">();
  for (const m of (marks ?? []) as { student_id: string; date: string; status: "present" | "absent" }[]) {
    byStudentDate.set(`${m.student_id}_${m.date}`, m.status);
  }

  const header = ["Admission No", "Student Name", ...dates.map((d) => d.slice(8)), "Present", "Absent"];
  const lines = [header.map(csvCell).join(",")];

  for (const s of students) {
    let present = 0;
    let absent = 0;
    const cells = dates.map((d) => {
      const status = byStudentDate.get(`${s.id}_${d}`);
      if (status === "present") present++;
      else if (status === "absent") absent++;
      return status === "present" ? "Present" : status === "absent" ? "Absent" : "";
    });
    lines.push(
      [
        csvCell(s.admission_no ?? ""),
        csvCell(s.full_name),
        ...cells.map(csvCell),
        csvCell(present),
        csvCell(absent),
      ].join(",")
    );
  }

  const csv = "﻿" + lines.join("\r\n") + "\r\n";
  const className = (klass?.display_name ?? "class").replace(/[^a-z0-9]+/gi, "-");
  const filename = `attendance-${className}-${section}-${year}-${pad(month)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
