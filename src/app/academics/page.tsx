import Link from "next/link";
import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayStr, prettyDate } from "@/lib/attendance";
import { monthYearLabel } from "@/lib/utils";
import StatCard from "@/components/stat-card";
import BarChart, { type Bar } from "@/components/bar-chart";
import { loadClassesAndSections } from "./shared";
import AttendanceExportForm from "./export-form";

export const dynamic = "force-dynamic";

type Range = "day" | "week" | "month";

// Inclusive [from, to] window (YYYY-MM-DD) for the chosen range, ending today.
function rangeWindow(range: Range): { from: string; to: string; label: string } {
  const to = todayStr();
  const now = new Date();
  if (range === "day") return { from: to, to, label: prettyDate(to) };
  if (range === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    return { from: todayStr(d), to, label: "Last 7 days" };
  }
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: todayStr(first), to, label: monthYearLabel(now) };
}

export default async function AcademicsDashboard({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const profile = await requireDepartment("academics");
  const schoolId = await getCurrentSchoolId(profile);
  const { range: rawRange } = await searchParams;
  const range: Range = rawRange === "week" || rawRange === "month" ? rawRange : "day";
  const win = rangeWindow(range);

  const supabase = await createClient();
  const today = todayStr();

  const { classes, sectionsByClass } = await loadClassesAndSections(schoolId);

  const [studentsRes, todayRes, rangeRes] = await Promise.all([
    supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("status", "active"),
    supabase.from("attendance").select("status").eq("school_id", schoolId).eq("date", today),
    supabase
      .from("attendance")
      .select("class_id, status")
      .eq("school_id", schoolId)
      .gte("date", win.from)
      .lte("date", win.to),
  ]);

  const totalStudents = studentsRes.count ?? 0;
  const todayRows = (todayRes.data ?? []) as { status: "present" | "absent" }[];
  const presentToday = todayRows.filter((r) => r.status === "present").length;
  const markedToday = todayRows.length;

  // Per-class attendance rate over the window.
  const agg = new Map<string, { present: number; total: number }>();
  for (const r of (rangeRes.data ?? []) as { class_id: string | null; status: string }[]) {
    if (!r.class_id) continue;
    const a = agg.get(r.class_id) ?? { present: 0, total: 0 };
    a.total += 1;
    if (r.status === "present") a.present += 1;
    agg.set(r.class_id, a);
  }

  const bars: Bar[] = classes
    .filter((c) => agg.has(c.id))
    .map((c) => {
      const a = agg.get(c.id)!;
      return {
        label: c.display_name,
        value: a.total ? (a.present / a.total) * 100 : 0,
        caption: `${a.present}/${a.total}`,
      };
    });

  return (
    <div className="max-w-6xl">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Academics</h1>
        <p className="text-stone-500 text-sm">Attendance overview across the school — {prettyDate(today)}</p>
      </header>

      <div data-tour="academics-stats" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title="Total Students" value={totalStudents} icon="🎓" tone="sky" href="/academics/students" />
        <StatCard
          title="Present Today"
          value={markedToday ? presentToday : "—"}
          hint={markedToday ? `of ${markedToday} marked today` : "No class marked yet today"}
          icon="✅"
          tone="emerald"
        />
        <StatCard
          title="Absent Today"
          value={markedToday ? markedToday - presentToday : "—"}
          hint={markedToday ? "across marked classes" : "No class marked yet today"}
          icon="🚫"
          tone="rose"
        />
      </div>

      <section className="mt-10">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 data-tour="academics-chart" className="text-lg font-medium">Attendance by Class</h2>
            <p className="text-sm text-stone-500">{win.label}</p>
          </div>
          <div data-tour="academics-range" className="inline-flex rounded-lg border border-stone-200 bg-white p-0.5 text-sm">
            {(["day", "week", "month"] as Range[]).map((r) => (
              <Link
                key={r}
                href={`/academics?range=${r}`}
                className={
                  "rounded-md px-3 py-1.5 font-medium capitalize transition " +
                  (range === r ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100")
                }
              >
                {r}
              </Link>
            ))}
          </div>
        </div>
        <BarChart bars={bars} empty={`No attendance recorded for ${win.label.toLowerCase()}.`} />
      </section>

      <section className="mt-10">
        <div className="card p-5">
          <h2 className="text-lg font-medium">Export Monthly Attendance</h2>
          <p className="mb-4 text-sm text-stone-500">
            Download a class&apos;s attendance for a month as CSV — one row per student, one
            column per date, marked Present / Absent.
          </p>
          <AttendanceExportForm classes={classes} sectionsByClass={sectionsByClass} />
        </div>
      </section>
    </div>
  );
}
