"use client";

import { useRef, useState, useTransition } from "react";
import { setDepartment, logout } from "@/app/actions/auth";
import { markStaffAttendance } from "@/app/actions/staff-attendance";
import {
  DEPARTMENT_LABELS,
  ROLE_LABELS,
  type Department,
  type Role,
} from "@/lib/access";

type Props = {
  fullName: string;
  email: string;
  role: Role;
  department: Department;
  allowed: Department[];
  canMarkAttendance: boolean;
  markedAt: string | null;
};

export default function Topbar({
  fullName,
  email,
  role,
  department,
  allowed,
  canMarkAttendance,
  markedAt,
}: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const canSwitch = role !== "staff" && allowed.length > 1;

  return (
    <header className="flex items-center justify-between gap-4 border-b border-[color:var(--border)] bg-[color:var(--card)] px-6 py-3">
      <div className="flex items-center gap-3">
        <span className="text-xs uppercase tracking-wide text-stone-400">Department</span>
        {canSwitch ? (
          // Switching submits the server action, which sets the cookie; the
          // action's revalidation re-renders the shell + page for the new dept.
          <form ref={formRef} action={setDepartment}>
            <select
              name="department"
              defaultValue={department}
              onChange={() => formRef.current?.requestSubmit()}
              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium"
            >
              {allowed.map((d) => (
                <option key={d} value={d}>
                  {DEPARTMENT_LABELS[d]}
                </option>
              ))}
            </select>
          </form>
        ) : (
          <span className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-sm font-medium">
            {DEPARTMENT_LABELS[department]}
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        {canMarkAttendance && <MarkAttendanceButton initialMarkedAt={markedAt} />}
        <div className="text-right leading-tight">
          <div className="text-sm font-medium">{fullName || email}</div>
          <div className="text-xs text-stone-500">{ROLE_LABELS[role]}</div>
        </div>
        <form action={logout}>
          <button className="rounded-lg border border-stone-200 bg-stone-100 px-3 py-1.5 text-sm text-stone-900 hover:bg-stone-200">
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

// Captures the device location (best-effort) and stamps the time via the
// server action. Already-marked staff see when, and can re-mark.
function MarkAttendanceButton({ initialMarkedAt }: { initialMarkedAt: string | null }) {
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
          ? "Marking…"
          : markedAt
            ? `✓ Marked · ${fmtTime(markedAt)}`
            : "Mark Attendance"}
      </button>
      {error && <span className="mt-0.5 text-xs text-red-600">{error}</span>}
    </div>
  );
}
