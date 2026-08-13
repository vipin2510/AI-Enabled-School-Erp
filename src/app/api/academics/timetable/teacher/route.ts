import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireDepartment, getCurrentSchoolId, getCurrentSchool } from "@/lib/auth";
import { currentAcademicYear } from "@/lib/results";
import { createClient } from "@/lib/supabase/server";
import { assetDataUrl } from "@/lib/pdf-assets";
import { DAYS } from "@/lib/timetable";
import { TeacherTimetablePdf, type TeacherGrid, type TimetableMeta } from "@/components/timetable-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/academics/timetable/teacher?teacherId=  → this teacher's periods
// aggregated across every class they teach (plus class-teacher first periods).
export async function GET(req: Request) {
  const profile = await requireDepartment("academics");
  const schoolId = await getCurrentSchoolId(profile);
  const school = await getCurrentSchool(profile);
  const url = new URL(req.url);
  const teacherId = url.searchParams.get("teacherId") ?? "";
  if (!teacherId) return NextResponse.json({ error: "Missing teacherId" }, { status: 400 });

  const supabase = await createClient();
  const [{ data: teacher }, { data: classes }, { data: slots }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", teacherId).maybeSingle(),
    supabase.from("classes").select("id, display_name").eq("school_id", schoolId),
    supabase
      .from("timetable_slots")
      .select("class_id, section, day, period, subject_name")
      .eq("school_id", schoolId)
      .eq("kind", "regular")
      .eq("teacher_id", teacherId),
  ]);

  const classLabel = new Map(
    ((classes ?? []) as { id: string; display_name: string }[]).map((c) => [c.id, c.display_name])
  );
  const label = (classId: string, section: string) =>
    `${classLabel.get(classId) ?? "?"}${section ? `-${section}` : ""}`;

  const grid: TeacherGrid = {};
  const push = (day: number, period: number, text: string) => {
    const k = `${day}-${period}`;
    (grid[k] ??= []).push(text);
  };

  // Teaching slots across every class (period 1 is a normal slot now).
  for (const s of (slots ?? []) as {
    class_id: string;
    section: string;
    day: number;
    period: number;
    subject_name: string | null;
  }[]) {
    const subj = s.subject_name ? `: ${s.subject_name}` : "";
    push(s.day, s.period, `${label(s.class_id, s.section)}${subj}`);
  }

  const logoDataUrl = await assetDataUrl("letterhead/aps-logo.jpeg");
  const teacherName = teacher?.full_name || "Teacher";

  const meta: TimetableMeta = {
    title: teacherName,
    schoolName: school?.name ?? "Adeshwar Public School",
    schoolLocation: school?.location ?? "",
    schoolParentNote: school?.parentNote ?? null,
    academicYear: currentAcademicYear(),
  };

  const buf = await renderToBuffer(
    TeacherTimetablePdf({ meta, days: DAYS, grid, logoDataUrl }) as never
  );

  const safe = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  const filename = `timetable-teacher-${safe(teacherName)}.pdf`;
  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
