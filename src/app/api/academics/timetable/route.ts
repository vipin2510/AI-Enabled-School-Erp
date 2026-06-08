import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import path from "node:path";
import fs from "node:fs/promises";
import { requireDepartment } from "@/lib/auth";
import { getCurrentSchool } from "@/lib/auth";
import { currentAcademicYear } from "@/lib/results";
import { TimetablePdf, type TimetableMeta } from "@/components/timetable-pdf";
import type { Timetable } from "@/lib/timetable";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Timetables aren't persisted — the client posts the chosen variant + class name
// and we render it on the fly. We trust the shape because both the generator
// and the PDF live in the same codebase; we only sanity-check what we need.
function isTimetable(x: unknown): x is Timetable {
  if (!x || typeof x !== "object") return false;
  const t = x as Timetable;
  return (
    typeof t.label === "string" &&
    Array.isArray(t.slots) &&
    Array.isArray(t.days) &&
    Array.isArray(t.grid)
  );
}

export async function POST(req: Request) {
  const profile = await requireDepartment("academics");
  const school = await getCurrentSchool(profile);

  let body: { className?: string; timetable?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const className = typeof body.className === "string" ? body.className.trim() : "";
  if (!className) {
    return NextResponse.json({ error: "Missing className" }, { status: 400 });
  }
  if (!isTimetable(body.timetable)) {
    return NextResponse.json({ error: "Invalid timetable payload" }, { status: 400 });
  }

  const logoPath = path.join(process.cwd(), "public", "letterhead", "aps-logo.jpeg");
  const logoBytes = await fs.readFile(logoPath);
  const logoDataUrl = `data:image/jpeg;base64,${logoBytes.toString("base64")}`;

  const meta: TimetableMeta = {
    className,
    schoolName: school?.name ?? "Adeshwar Public School",
    schoolLocation: school?.location ?? "",
    schoolParentNote: school?.parentNote ?? null,
    academicYear: currentAcademicYear(),
  };

  const buf = await renderToBuffer(
    TimetablePdf({ meta, timetable: body.timetable, logoDataUrl }) as never
  );

  const safe = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  const filename = `timetable-${safe(className)}-${safe(body.timetable.label)}.pdf`;

  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
