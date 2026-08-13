import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireDepartment, getCurrentSchoolId, getCurrentSchool } from "@/lib/auth";
import { currentAcademicYear } from "@/lib/results";
import { createClient } from "@/lib/supabase/server";
import { assetDataUrl } from "@/lib/pdf-assets";
import { loadSchoolPdfSettings } from "@/lib/pdf-settings";
import { DAYS } from "@/lib/timetable";
import { ClassTimetablePdf, type ClassGrid, type TimetableMeta } from "@/components/timetable-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/academics/timetable?classId=&section=  → class-wise timetable PDF
export async function GET(req: Request) {
  const profile = await requireDepartment("academics");
  const schoolId = await getCurrentSchoolId(profile);
  const school = await getCurrentSchool(profile);
  const url = new URL(req.url);
  const classId = url.searchParams.get("classId") ?? "";
  const section = url.searchParams.get("section") ?? "";
  const kind = url.searchParams.get("kind") === "remedial" ? "remedial" : "regular";
  if (!classId) return NextResponse.json({ error: "Missing classId" }, { status: 400 });

  const supabase = await createClient();
  const [{ data: klass }, { data: slots }, { data: ct }, { data: profiles }, { data: remMeta }, settings] =
    await Promise.all([
      supabase.from("classes").select("display_name").eq("school_id", schoolId).eq("id", classId).maybeSingle(),
      supabase
        .from("timetable_slots")
        .select("day, period, subject_name, teacher_id")
        .eq("school_id", schoolId)
        .eq("class_id", classId)
        .eq("section", section)
        .eq("kind", kind),
      supabase
        .from("class_teachers")
        .select("teacher_id, signature_url")
        .eq("school_id", schoolId)
        .eq("class_id", classId)
        .eq("section", section)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("id, full_name")
        .eq("group_id", profile.group_id)
        .contains("school_ids", [schoolId]),
      kind === "remedial"
        ? supabase
            .from("remedial_timetables")
            .select("start_date, end_date")
            .eq("school_id", schoolId)
            .eq("class_id", classId)
            .eq("section", section)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      loadSchoolPdfSettings(supabase, schoolId),
    ]);

  if (!klass) return NextResponse.json({ error: "Class not found" }, { status: 404 });

  const nameById = new Map(
    ((profiles ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name || ""])
  );

  const grid: ClassGrid = {};
  for (const s of (slots ?? []) as { day: number; period: number; subject_name: string | null; teacher_id: string | null }[]) {
    grid[`${s.day}-${s.period}`] = {
      subject: s.subject_name ?? "",
      teacher: s.teacher_id ? nameById.get(s.teacher_id) ?? "" : "",
    };
  }

  const classTeacherName = ct?.teacher_id ? nameById.get(ct.teacher_id) ?? null : null;
  const logoDataUrl = await assetDataUrl("letterhead/aps-logo.jpeg");

  const remWindow =
    kind === "remedial" && (remMeta?.start_date || remMeta?.end_date)
      ? ` · Remedial (${remMeta?.start_date ?? "…"} → ${remMeta?.end_date ?? "…"})`
      : kind === "remedial"
      ? " · Remedial"
      : "";
  const meta: TimetableMeta = {
    title: `${klass.display_name}${section ? ` · ${section}` : ""}${remWindow}`,
    schoolName: school?.name ?? "Adeshwar Public School",
    schoolLocation: school?.location ?? "",
    schoolParentNote: school?.parentNote ?? null,
    academicYear: currentAcademicYear(),
  };

  const buf = await renderToBuffer(
    ClassTimetablePdf({
      meta,
      days: DAYS,
      grid,
      classTeacherName,
      logoDataUrl,
      classTeacherSignatureUrl: ct?.signature_url ?? null,
      principalSignatureUrl: settings.principal_signature_url,
    }) as never
  );

  const safe = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  const filename = `timetable-${safe(meta.title)}.pdf`;
  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
