"use client";

import { useActionState, useState } from "react";
import { createUser, type ActionState } from "./actions";
import { DEPARTMENTS } from "@/lib/access";

export default function CreateUserForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createUser, undefined);
  const [role, setRole] = useState("staff");

  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Full name">
          <input name="full_name" required className={inputCls} />
        </Field>
        <Field label="Email">
          <input name="email" type="email" required className={inputCls} />
        </Field>
        <Field label="Password">
          <input name="password" type="text" required minLength={6} className={inputCls} />
        </Field>
        <Field label="Role (layer)">
          <select
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className={inputCls}
          >
            <option value="admin">Admin — Layer 1 (full access)</option>
            <option value="manager">Manager — Layer 2 (all departments)</option>
            <option value="staff">Staff — Layer 3 (one department)</option>
          </select>
        </Field>
        <Field label="Department">
          <select name="department" disabled={role !== "staff"} className={inputCls} defaultValue="">
            <option value="">{role === "staff" ? "Select…" : "All (admin/manager)"}</option>
            {DEPARTMENTS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-emerald-700">{state.success}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-stone-50 disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create login"}
      </button>
    </form>
  );
}

const inputCls = "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-stone-600 mb-1">{label}</span>
      {children}
    </label>
  );
}
