import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole, getCurrentSchoolId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  ROLE_LABELS,
  DEPARTMENT_LABELS,
  SCHOOLS,
  type Role,
  type Department,
} from "@/lib/access";
import { formatTime, formatDate } from "@/lib/utils";
import { todayStr } from "@/lib/attendance";
import { DAYS, periodsForDay, MAX_PERIOD } from "@/lib/timetable";

export const dynamic = "force-dynamic";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: Role;
  department: Department | null;
  school_ids: string[] | null;
  is_active: boolean;
  created_at: string;
};

type Mark = {
  date: string;
  marked_at: string;
  latitude: number | null;
  longitude: number | null;
};

export default async function StaffProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Admin-only; layer 2/3 self-service for their own data lives elsewhere.
  const me = await requireRole("admin");
  const { id } = await params;
  const schoolId = await getCurrentSchoolId(me);
  const supabase = await createClient();

  const [{ data: profileRow }, { data: marksData }, { data: slotRows }, { data: ctRows }, { data: classRows }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, phone, role, department, school_ids, group_id, is_active, created_at")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("staff_attendance")
        .select("date, marked_at, latitude, longitude")
        .eq("profile_id", id)
        .eq("school_id", schoolId)
        .order("date", { ascending: false })
        .order("marked_at", { ascending: false })
        .limit(180),
      // This teacher's periods across every class (regular timetable).
      supabase
        .from("timetable_slots")
        .select("class_id, section, day, period, subject_name")
        .eq("school_id", schoolId)
        .eq("kind", "regular")
        .eq("teacher_id", id),
      // Classes where this teacher is the class teacher.
      supabase
        .from("class_teachers")
        .select("class_id, section")
        .eq("school_id", schoolId)
        .eq("teacher_id", id),
      supabase.from("classes").select("id, display_name, ordinal").eq("school_id", schoolId).order("ordinal"),
    ]);

  // Don't let an admin view a staffer outside their own group via a direct URL.
  if (!profileRow || (profileRow as { group_id: string | null }).group_id !== me.group_id) {
    notFound();
  }
  const profile = profileRow as Profile;
  const marks = (marksData ?? []) as Mark[];

  // Aggregates: days present in the last 30 days and overall in the fetched
  // window (cap at 180 days above).
  const today = todayStr();
  const cutoff30 = new Date();
  cutoff30.setDate(cutoff30.getDate() - 29);
  const cutoff30Str = cutoff30.toISOString().slice(0, 10);

  const daysAll = new Set(marks.map((m) => m.date));
  const days30 = new Set(marks.filter((m) => m.date >= cutoff30Str).map((m) => m.date));

  // Teaching data derived from the timetable.
  type Slot = { class_id: string; section: string; day: number; period: number; subject_name: string | null };
  const slots = (slotRows ?? []) as Slot[];
  const cts = (ctRows ?? []) as { class_id: string; section: string }[];
  const classNameById = new Map(
    ((classRows ?? []) as { id: string; display_name: string }[]).map((c) => [c.id, c.display_name])
  );
  const classLabel = (classId: string, section: string) =>
    `${classNameById.get(classId) ?? "?"}${section ? `-${section}` : ""}`;

  const subjectsTaught = Array.from(
    new Set(slots.map((s) => s.subject_name?.trim()).filter((s): s is string => !!s))
  ).sort();

  const classesTaught = Array.from(
    new Set([
      ...slots.map((s) => classLabel(s.class_id, s.section)),
      ...cts.map((c) => classLabel(c.class_id, c.section)),
    ])
  ).sort();

  // Weekly grid: `${day}-${period}` → list of "Class-Section: Subject" entries.
  const teacherGrid: Record<string, string[]> = {};
  for (const s of slots) {
    const k = `${s.day}-${s.period}`;
    const subj = s.subject_name ? `: ${s.subject_name}` : "";
    (teacherGrid[k] ??= []).push(`${classLabel(s.class_id, s.section)}${subj}`);
  }
  const periods = Array.from({ length: MAX_PERIOD }, (_, i) => i + 1);
  const hasTimetable = slots.length > 0;

  const schoolLabel = (sid: string) =>
    SCHOOLS.find((s) => s.id === sid)?.location.split(",")[0] ?? sid.slice(0, 8);

  return (
    <div className="max-w-4xl">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/staff-attendance" className="text-sm text-stone-500 hover:underline">
            ← Staff attendance
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {profile.full_name || "—"}
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            {ROLE_LABELS[profile.role] ?? profile.role}
            {profile.department
              ? ` · ${DEPARTMENT_LABELS[profile.department] ?? profile.department}`
              : ""}
            {profile.is_active ? "" : " · Inactive"}
          </p>
        </div>
        <a
          href={`/api/admin/staff-attendance-export?profile_id=${profile.id}`}
          className="rounded-lg border border-stone-200 bg-stone-100 px-4 py-2 text-sm font-medium text-stone-900 hover:bg-stone-200"
          title="Just this staff member's full attendance history"
        >
          ⤓ Export CSV
        </a>
      </header>

      <section className="card mb-6 p-5">
        <h2 className="mb-3 text-sm font-semibold text-stone-800">Profile</h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <Detail label="Phone" value={profile.phone} />
          <Detail label="Email" value={profile.email} />
          <Detail label="Role" value={ROLE_LABELS[profile.role] ?? profile.role} />
          <Detail
            label="Department"
            value={profile.department ? DEPARTMENT_LABELS[profile.department] ?? profile.department : null}
          />
          <Detail
            label="Schools"
            value={
              profile.role === "admin"
                ? "All"
                : (profile.school_ids ?? []).map(schoolLabel).join(", ") || null
            }
          />
          <Detail label="Active" value={profile.is_active ? "Yes" : "No"} />
          <Detail label="Created" value={formatDate(profile.created_at)} />
        </dl>
      </section>

      <section className="card mb-6 p-5">
        <h2 className="mb-3 text-sm font-semibold text-stone-800">Attendance</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Days present (30d)" value={days30.size} max={30} />
          <Stat label="Days present (180d)" value={daysAll.size} max={180} />
          <Stat label="Today" value={marks.some((m) => m.date === today) ? "Present" : "Absent"} />
          <Stat
            label="Last marked"
            value={marks[0] ? `${formatDate(marks[0].date)} · ${formatTime(marks[0].marked_at)}` : "—"}
          />
        </div>
      </section>

      <section className="card mb-6 p-5">
        <h2 className="mb-3 text-sm font-semibold text-stone-800">Teaching</h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          <div>
            <dt className="mb-1.5 text-xs text-stone-500">Subjects taught</dt>
            <dd className="flex flex-wrap gap-1.5">
              {subjectsTaught.length ? (
                subjectsTaught.map((s) => (
                  <span key={s} className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-700">
                    {s}
                  </span>
                ))
              ) : (
                <span className="text-sm text-stone-400">—</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="mb-1.5 text-xs text-stone-500">Classes taught</dt>
            <dd className="flex flex-wrap gap-1.5">
              {classesTaught.length ? (
                classesTaught.map((c) => (
                  <span key={c} className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-700">
                    {c}
                  </span>
                ))
              ) : (
                <span className="text-sm text-stone-400">—</span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section className="card mb-6 overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold text-stone-800">Weekly timetable</h2>
            <p className="mt-0.5 text-xs text-stone-500">
              This teacher&apos;s periods across every class (regular timetable).
            </p>
          </div>
          {hasTimetable && (
            <a
              href={`/api/academics/timetable/teacher?teacherId=${profile.id}`}
              className="rounded-lg border border-stone-200 bg-stone-100 px-4 py-2 text-sm font-medium text-stone-900 hover:bg-stone-200"
            >
              ⤓ Teacher timetable PDF
            </a>
          )}
        </div>
        {hasTimetable ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="border border-stone-200 bg-stone-50 px-2 py-1.5 text-left font-medium">Day</th>
                  {periods.map((p) => (
                    <th key={p} className="border border-stone-200 bg-stone-50 px-2 py-1.5 font-medium">
                      P{p}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((d) => (
                  <tr key={d.n}>
                    <td className="border border-stone-200 bg-stone-50 px-2 py-1.5 font-medium whitespace-nowrap">
                      {d.full}
                    </td>
                    {periods.map((p) => {
                      if (p > periodsForDay(d.n)) {
                        return (
                          <td key={p} className="border border-stone-200 bg-stone-100 px-2 py-1.5 text-center text-stone-300">
                            —
                          </td>
                        );
                      }
                      const entries = teacherGrid[`${d.n}-${p}`] ?? [];
                      return (
                        <td key={p} className="border border-stone-200 px-2 py-1.5 align-top">
                          {entries.length ? (
                            entries.map((e, i) => (
                              <div key={i} className="text-stone-700">
                                {e}
                              </div>
                            ))
                          ) : (
                            <span className="text-stone-300">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 py-6 text-sm text-stone-500">
            No timetable periods assigned to this teacher yet.
          </p>
        )}
      </section>

      <section className="card overflow-hidden p-0">
        <div className="px-5 py-3">
          <h2 className="text-sm font-semibold text-stone-800">Attendance log</h2>
          <p className="mt-0.5 text-xs text-stone-500">
            Most recent 180 days. {marks.length} entries.
          </p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-5 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Marked at</th>
              <th className="px-3 py-2 font-medium">Location</th>
            </tr>
          </thead>
          <tbody>
            {marks.map((m, i) => (
              <tr key={`${m.date}-${i}`} className="border-t border-stone-100">
                <td className="px-5 py-2 font-medium text-stone-800">{formatDate(m.date)}</td>
                <td className="px-3 py-2 text-stone-600">{formatTime(m.marked_at)}</td>
                <td className="px-3 py-2">
                  {m.latitude != null && m.longitude != null ? (
                    <a
                      href={`https://www.google.com/maps?q=${m.latitude},${m.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-sky-700 hover:underline"
                    >
                      View on map ↗
                    </a>
                  ) : (
                    <span className="text-xs text-stone-400">No location</span>
                  )}
                </td>
              </tr>
            ))}
            {!marks.length && (
              <tr>
                <td colSpan={3} className="px-5 py-8 text-center text-stone-500">
                  No attendance recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-stone-500">{label}</dt>
      <dd className="font-medium text-stone-800">{value || "—"}</dd>
    </div>
  );
}

function Stat({
  label,
  value,
  max,
}: {
  label: string;
  value: number | string;
  max?: number;
}) {
  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
      <div className="text-xl font-semibold tabular-nums text-stone-900">
        {value}
        {typeof value === "number" && max != null && (
          <span className="ml-1 text-sm font-normal text-stone-400">/ {max}</span>
        )}
      </div>
      <div className="text-xs uppercase tracking-wide text-stone-500">{label}</div>
    </div>
  );
}
