"use client";

import { useRef } from "react";
import { setDepartment, logout } from "@/app/actions/auth";
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
};

export default function Topbar({ fullName, email, role, department, allowed }: Props) {
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
