"use client";

import { useActionState, useState } from "react";
import { createUser, type ActionState } from "./actions";
import { DEPARTMENTS, SCHOOLS } from "@/lib/access";

export default function CreateUserForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createUser, undefined);
  const [role, setRole] = useState<"admin" | "manager" | "staff">("staff");
  // Staff gets a radio (one school); manager gets checkboxes (subset);
  // admin auto-spans all schools (the server enforces this regardless).
  const [singleSchool, setSingleSchool] = useState<string>(SCHOOLS[0]?.id ?? "");
  const [multiSchools, setMultiSchools] = useState<string[]>(SCHOOLS.map((s) => s.id));

  const toggleSchool = (id: string) => {
    setMultiSchools((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Full name">
          <input name="full_name" required className={inputCls} />
        </Field>
        <Field label="Phone (login)">
          <input
            name="phone"
            type="tel"
            inputMode="numeric"
            pattern="\d{10}"
            placeholder="10-digit mobile"
            required
            className={inputCls}
          />
        </Field>
        <Field label="Initial password">
          <input name="password" type="text" required minLength={6} className={inputCls} />
        </Field>
        <Field label="Role (layer)">
          <select
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
            className={inputCls}
          >
            <option value="admin">Admin — Layer 1 (every school, every dept)</option>
            <option value="manager">Manager — Layer 2 (multiple schools)</option>
            <option value="staff">Staff — Layer 3 (one school, one dept)</option>
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

      <fieldset className="rounded-lg border border-stone-200 p-3">
        <legend className="px-2 text-xs font-medium text-stone-600">School access</legend>
        {role === "admin" && (
          <div className="text-sm text-stone-600">
            Admins see every school. {SCHOOLS.length} schools assigned automatically.
            {SCHOOLS.map((s) => (
              <input key={s.id} type="hidden" name="school_ids" value={s.id} />
            ))}
          </div>
        )}
        {role === "manager" && (
          <div className="space-y-2">
            {SCHOOLS.map((s) => (
              <label key={s.id} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  name="school_ids"
                  value={s.id}
                  checked={multiSchools.includes(s.id)}
                  onChange={() => toggleSchool(s.id)}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">{s.location.split(",")[0]}</span>
                  <span className="ml-1 text-xs text-stone-500">— {s.name}</span>
                </span>
              </label>
            ))}
            <p className="text-xs text-stone-500">
              Tick every school this manager should be able to switch between.
            </p>
          </div>
        )}
        {role === "staff" && (
          <div className="space-y-2">
            {SCHOOLS.map((s) => (
              <label key={s.id} className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="school_ids"
                  value={s.id}
                  checked={singleSchool === s.id}
                  onChange={() => setSingleSchool(s.id)}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">{s.location.split(",")[0]}</span>
                  <span className="ml-1 text-xs text-stone-500">— {s.name}</span>
                </span>
              </label>
            ))}
            <p className="text-xs text-stone-500">
              Staff are pinned to a single school. They cannot switch.
            </p>
          </div>
        )}
      </fieldset>

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
