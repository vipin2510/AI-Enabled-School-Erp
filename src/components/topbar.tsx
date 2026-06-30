"use client";

import { useRef, useState, useTransition } from "react";
import { setDepartment, setSchool, logout } from "@/app/actions/auth";
import { exitDemo } from "@/app/actions/demo";
import { setLocale } from "@/app/actions/i18n";
import { markStaffAttendance } from "@/app/actions/staff-attendance";
import { formatTime } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n/config";
import {
  DEPARTMENT_LABELS,
  ROLE_LABELS,
  type Department,
  type Role,
  type School,
} from "@/lib/access";

type Props = {
  fullName: string;
  email: string;
  role: Role;
  department: Department;
  allowed: Department[];
  school: School;
  allowedSchools: School[];
  // What this group calls a tenant unit ("School" for Adeshwar, "Institute" for
  // Tagore). Also the heading above the switcher.
  unitLabel: string;
  canMarkAttendance: boolean;
  markedAt: string | null;
  locale: Locale;
  isDemo?: boolean;
};

export default function Topbar({
  fullName,
  email,
  role,
  department,
  allowed,
  school,
  allowedSchools,
  unitLabel,
  canMarkAttendance,
  markedAt,
  locale,
  isDemo,
}: Props) {
  const t = useT();
  const deptFormRef = useRef<HTMLFormElement>(null);
  const schoolFormRef = useRef<HTMLFormElement>(null);
  const canSwitchDept = role !== "staff" && allowed.length > 1;
  const canSwitchSchool = role !== "staff" && allowedSchools.length > 1;

  // Label each unit by whatever distinguishes it: the town when towns differ
  // (Adeshwar's branches), otherwise the unit's name (Tagore's institutes all
  // sit in one town, so the name — Pharmacy / School / Management — is what
  // tells them apart).
  const city = (s: School) => s.location.split(",")[0];
  const citiesUnique =
    new Set(allowedSchools.map(city)).size === allowedSchools.length;
  const unitName = (s: School) => (citiesUnique ? city(s) : s.name);

  return (
    <header className="flex items-center justify-between gap-4 border-b border-[color:var(--border)] bg-[color:var(--card)] px-6 py-3">
      <div className="flex items-center gap-6">
        {isDemo && (
          <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
            {t("Demo — data is temporary")}
          </span>
        )}
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-wide text-stone-400">{t(unitLabel)}</span>
          {canSwitchSchool ? (
            <form ref={schoolFormRef} action={setSchool}>
              <input type="hidden" name="next" value="/" />
              <select
                name="school_id"
                defaultValue={school.id}
                onChange={() => schoolFormRef.current?.requestSubmit()}
                className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium"
                title={school.location}
              >
                {allowedSchools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {unitName(s)}
                  </option>
                ))}
              </select>
            </form>
          ) : (
            <span
              className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-sm font-medium"
              title={school.location}
            >
              {unitName(school)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-wide text-stone-400">{t("Department")}</span>
          {canSwitchDept ? (
            // Switching submits the server action, which sets the cookie; the
            // action's revalidation re-renders the shell + page for the new dept.
            <form ref={deptFormRef} action={setDepartment}>
              <select
                name="department"
                defaultValue={department}
                onChange={() => deptFormRef.current?.requestSubmit()}
                className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium"
              >
                {allowed.map((d) => (
                  <option key={d} value={d}>
                    {t(DEPARTMENT_LABELS[d])}
                  </option>
                ))}
              </select>
            </form>
          ) : (
            <span className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-sm font-medium">
              {t(DEPARTMENT_LABELS[department])}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <LangToggle current={locale} />
        {canMarkAttendance && <MarkAttendanceButton initialMarkedAt={markedAt} />}
        <div className="text-right leading-tight">
          <div className="text-sm font-medium">{fullName || email}</div>
          <div className="text-xs text-stone-500">{t(ROLE_LABELS[role])}</div>
        </div>
        {isDemo ? (
          <form action={exitDemo}>
            <button className="rounded-lg border border-amber-300 bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-200">
              {t("Exit demo")}
            </button>
          </form>
        ) : (
          <form action={logout}>
            <button className="rounded-lg border border-stone-200 bg-stone-100 px-3 py-1.5 text-sm text-stone-900 hover:bg-stone-200">
              {t("Sign out")}
            </button>
          </form>
        )}
      </div>
    </header>
  );
}

// EN / हिं switch. Each button posts the locale to the server action, which
// sets the cookie and revalidates the layout so the whole app re-renders.
function LangToggle({ current }: { current: Locale }) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-stone-200">
      {LOCALES.map((loc) => (
        <form key={loc} action={setLocale}>
          <input type="hidden" name="locale" value={loc} />
          <button
            type="submit"
            aria-pressed={current === loc}
            className={
              "px-2.5 py-1.5 text-sm font-medium transition " +
              (current === loc
                ? "bg-stone-900 text-white"
                : "bg-white text-stone-600 hover:bg-stone-50")
            }
          >
            {LOCALE_LABELS[loc]}
          </button>
        </form>
      ))}
    </div>
  );
}

// Captures the device location (best-effort) and stamps the time via the
// server action. Already-marked staff see when, and can re-mark.
function MarkAttendanceButton({ initialMarkedAt }: { initialMarkedAt: string | null }) {
  const t = useT();
  const [markedAt, setMarkedAt] = useState<string | null>(initialMarkedAt);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [locating, setLocating] = useState(false);

  const mark = () => {
    setError(null);

    const send = (coords: { latitude: number; longitude: number; accuracy: number } | null) =>
      startTransition(async () => {
        const res = await markStaffAttendance(coords);
        if (res?.error) setError(res.error);
        else if (res?.markedAt) setMarkedAt(res.markedAt);
      });

    if (typeof navigator !== "undefined" && navigator.geolocation) {
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocating(false);
          send({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        () => {
          // Permission denied / unavailable — still record the time.
          setLocating(false);
          send(null);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      send(null);
    }
  };

  const busy = pending || locating;

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        onClick={mark}
        disabled={busy}
        className={
          "rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-60 " +
          (markedAt
            ? "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            : "bg-accent text-white hover:opacity-90")
        }
      >
        {busy
          ? t("Marking…")
          : markedAt
            ? `✓ ${t("Marked")} · ${formatTime(markedAt)}`
            : t("Mark Attendance")}
      </button>
      {error && <span className="mt-0.5 text-xs text-red-600">{error}</span>}
    </div>
  );
}
