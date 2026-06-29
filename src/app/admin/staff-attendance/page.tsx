import Link from "next/link";
import { requireRole, getCurrentSchoolId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS, type Role } from "@/lib/access";
import { todayStr, prettyDate } from "@/lib/attendance";
import { formatTime, monthYearLabel } from "@/lib/utils";
import StatCard from "@/components/stat-card";

export const dynamic = "force-dynamic";

type Range = "day" | "week" | "month";

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
  return {
    from: todayStr(first),
    to,
    label: monthYearLabel(now),
  };
}

type StaffProfile = { id: string; full_name: string | null; email: string | null; role: Role };
type Mark = {
  profile_id: string;
  date: string;
  marked_at: string;
  latitude: number | null;
  longitude: number | null;
};

export default async function StaffAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const profile = await requireRole("admin");
  const schoolId = await getCurrentSchoolId(profile);
  const { range: rawRange } = await searchParams;
  const range: Range = rawRange === "week" || rawRange === "month" ? rawRange : "day";
  const win = rangeWindow(range);
  const today = todayStr();

  const supabase = await createClient();
  const [{ data: staffData }, { data: marksData }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("group_id", profile.group_id)
      .in("role", ["manager", "staff"])
      .eq("is_active", true)
      .order("full_name"),
    supabase
      .from("staff_attendance")
      .select("profile_id, date, marked_at, latitude, longitude")
      .eq("school_id", schoolId)
      .gte("date", win.from)
      .lte("date", win.to),
  ]);

  const staff = (staffData ?? []) as StaffProfile[];
  const marks = (marksData ?? []) as Mark[];

  // Today's headline numbers (independent of the selected range).
  const presentTodaySet = new Set(marks.filter((m) => m.date === today).map((m) => m.profile_id));
  const presentToday = presentTodaySet.size;
  const totalStaff = staff.length;

  // Per-staff aggregates over the window.
  const byStaff = new Map<string, { days: Set<string>; today?: Mark }>();
  for (const m of marks) {
    const e = byStaff.get(m.profile_id) ?? { days: new Set<string>() };
    e.days.add(m.date);
    if (m.date === today) e.today = m;
    byStaff.set(m.profile_id, e);
  }

  return (
    <div className="max-w-5xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Staff Attendance</h1>
          <p className="text-stone-500 text-sm">
            Layer 2 &amp; Layer 3 mark themselves present from their device — {prettyDate(today)}.
          </p>
        </div>
        <a
          href="/api/admin/staff-attendance-export"
          className="rounded-lg border border-stone-200 bg-stone-100 px-4 py-2 text-sm font-medium text-stone-900 hover:bg-stone-200"
        >
          ⤓ Export CSV
        </a>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title="Present Today" value={`${presentToday} / ${totalStaff}`} icon="🧑‍🏫" tone="emerald" />
        <StatCard title="Absent Today" value={Math.max(totalStaff - presentToday, 0)} icon="🚷" tone="rose" />
        <StatCard title="Total Staff" value={totalStaff} icon="👥" tone="slate" />
      </div>

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium">
            {range === "day" ? "Today" : "Summary"}{" "}
            <span className="text-sm font-normal text-stone-500">· {win.label}</span>
          </h2>
          <div className="inline-flex rounded-lg border border-stone-200 bg-white p-0.5 text-sm">
            {(["day", "week", "month"] as Range[]).map((r) => (
              <Link
                key={r}
                href={`/admin/staff-attendance?range=${r}`}
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

        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-5 py-2 font-medium">Staff</th>
                <th className="px-3 py-2 font-medium">Role</th>
                {range === "day" ? (
                  <>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Time</th>
                    <th className="px-3 py-2 font-medium">Location</th>
                  </>
                ) : (
                  <th className="px-3 py-2 font-medium text-right">Days Present</th>
                )}
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => {
                const e = byStaff.get(s.id);
                const mark = e?.today;
                return (
                  <tr key={s.id} className="border-t border-stone-100">
                    <td className="px-5 py-2">
                      <Link
                        href={`/admin/staff/${s.id}`}
                        className="font-medium text-stone-800 hover:text-accent hover:underline"
                      >
                        {s.full_name || "—"}
                      </Link>
                      <div className="text-xs text-stone-400">{s.email}</div>
                    </td>
                    <td className="px-3 py-2 text-stone-600">{ROLE_LABELS[s.role]}</td>
                    {range === "day" ? (
                      <>
                        <td className="px-3 py-2">
                          {mark ? (
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                              Present
                            </span>
                          ) : (
                            <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
                              Absent
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-stone-600">{mark ? formatTime(mark.marked_at) : "—"}</td>
                        <td className="px-3 py-2">
                          {mark?.latitude != null && mark?.longitude != null ? (
                            <a
                              href={`https://www.google.com/maps?q=${mark.latitude},${mark.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-sky-700 hover:underline"
                            >
                              View on map ↗
                            </a>
                          ) : mark ? (
                            <span className="text-xs text-stone-400">No location</span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </>
                    ) : (
                      <td className="px-3 py-2 text-right font-medium text-stone-800">
                        {e?.days.size ?? 0}
                      </td>
                    )}
                  </tr>
                );
              })}
              {!staff.length && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-stone-500">
                    No Layer 2 / Layer 3 staff accounts yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
