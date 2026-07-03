"use client";

import { useActionState, useEffect, useState } from "react";
import { updateUserAccess, type ActionState } from "./actions";
import {
  DEPARTMENTS,
  ROLE_LABELS,
  type Department,
  type Role,
  type School,
} from "@/lib/access";

type EditUser = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  role: Role;
  department: Department | null;
  school_ids: string[];
};

export default function EditUserForm({
  user,
  schools,
}: {
  user: EditUser;
  schools: School[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateUserAccess,
    undefined,
  );

  const [role, setRole] = useState<Role>(user.role);
  // Staff → one school (radio); manager → subset (checkboxes); admin → all.
  const [singleSchool, setSingleSchool] = useState<string>(
    user.school_ids[0] ?? schools[0]?.id ?? "",
  );
  const [multiSchools, setMultiSchools] = useState<string[]>(
    user.school_ids.length ? user.school_ids : schools.map((s) => s.id),
  );

  const toggleSchool = (id: string) =>
    setMultiSchools((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  // Close the modal once the server confirms the update (the table revalidates).
  useEffect(() => {
    if (state?.success) {
      const t = setTimeout(() => setOpen(false), 700);
      return () => clearTimeout(t);
    }
  }, [state?.success]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-stone-600 hover:text-stone-900 hover:underline"
      >
        Edit access
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="font-medium">Edit access</h3>
                <p className="text-sm text-stone-500">
                  {user.full_name || user.phone || user.email || "user"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-stone-400 hover:text-stone-700"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form action={action} className="space-y-4">
              <input type="hidden" name="id" value={user.id} />

              <Field label="Role (layer)">
                <select
                  name="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className={inputCls}
                >
                  {(["admin", "manager", "staff"] as Role[]).map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Department">
                <select
                  name="department"
                  disabled={role !== "staff"}
                  className={inputCls}
                  defaultValue={user.department ?? ""}
                  key={role}
                >
                  <option value="">
                    {role === "staff" ? "Select…" : "All (admin/manager)"}
                  </option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </Field>

              <fieldset className="rounded-lg border border-stone-200 p-3">
                <legend className="px-2 text-xs font-medium text-stone-600">
                  School access
                </legend>
                {role === "admin" && (
                  <div className="text-sm text-stone-600">
                    Admins see every school. {schools.length} schools assigned
                    automatically.
                    {schools.map((s) => (
                      <input key={s.id} type="hidden" name="school_ids" value={s.id} />
                    ))}
                  </div>
                )}
                {role === "manager" && (
                  <div className="space-y-2">
                    {schools.map((s) => (
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
                    {schools.map((s) => (
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
                      Staff are pinned to a single school.
                    </p>
                  </div>
                )}
              </fieldset>

              {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
              {state?.success && <p className="text-sm text-emerald-700">{state.success}</p>}

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm text-stone-600 hover:text-stone-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-stone-50 disabled:opacity-60"
                >
                  {pending ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

const inputCls = "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-stone-600">{label}</span>
      {children}
    </label>
  );
}
