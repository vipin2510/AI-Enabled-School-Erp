"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { StudentState } from "./actions";

export type StudentValues = {
  full_name: string;
  admission_no: string;
  class_id: string;
  section: string;
  gender: string;
  father_name: string;
  father_mobile: string;
  mother_name: string;
  mother_mobile: string;
  contact_number: string;
  address: string;
  is_hosteller: boolean;
  is_new_admission: boolean;
  status: string;
  student_photo_url: string;
  parent_photo_url: string;
  bus_fee_amount: number | null;
};

type Props = {
  action: (prev: StudentState, formData: FormData) => Promise<StudentState>;
  classes: { id: string; display_name: string }[];
  sectionsByClass: Record<string, string[]>;
  initial?: Partial<StudentValues>;
  submitLabel: string;
};

const inputCls = "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm";

export default function StudentForm({
  action,
  classes,
  sectionsByClass,
  initial,
  submitLabel,
}: Props) {
  const [state, formAction, pending] = useActionState<StudentState, FormData>(action, undefined);
  const [classId, setClassId] = useState(initial?.class_id ?? "");
  const sections = sectionsByClass[classId] ?? [];

  return (
    <form action={formAction} encType="multipart/form-data" className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Full name *">
          <input name="full_name" required defaultValue={initial?.full_name ?? ""} className={inputCls} />
        </Field>
        <Field label="Admission no.">
          <input name="admission_no" defaultValue={initial?.admission_no ?? ""} className={inputCls} />
        </Field>
        <Field label="Class">
          <select
            name="class_id"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className={inputCls}
          >
            <option value="">— Select class —</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Section">
          {sections.length ? (
            <select name="section" defaultValue={initial?.section ?? ""} className={inputCls}>
              <option value="">— None —</option>
              {sections.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          ) : (
            <input
              name="section"
              defaultValue={initial?.section ?? ""}
              placeholder="No sections defined for this class"
              className={inputCls}
            />
          )}
        </Field>
        <Field label="Gender">
          <select name="gender" defaultValue={initial?.gender ?? ""} className={inputCls}>
            <option value="">—</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </Field>
        <Field label="Contact number">
          <input name="contact_number" defaultValue={initial?.contact_number ?? ""} className={inputCls} />
        </Field>
        <Field label="Father's name">
          <input name="father_name" defaultValue={initial?.father_name ?? ""} className={inputCls} />
        </Field>
        <Field label="Father's mobile">
          <input
            name="father_mobile"
            inputMode="numeric"
            pattern="\d{10}"
            maxLength={10}
            placeholder="10-digit number"
            defaultValue={initial?.father_mobile ?? ""}
            className={inputCls}
          />
        </Field>
        <Field label="Mother's name">
          <input name="mother_name" defaultValue={initial?.mother_name ?? ""} className={inputCls} />
        </Field>
        <Field label="Mother's mobile">
          <input
            name="mother_mobile"
            inputMode="numeric"
            pattern="\d{10}"
            maxLength={10}
            placeholder="10-digit number"
            defaultValue={initial?.mother_mobile ?? ""}
            className={inputCls}
          />
        </Field>
        <Field label="Status">
          <select name="status" defaultValue={initial?.status ?? "active"} className={inputCls}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="alumni">Alumni</option>
          </select>
        </Field>
        <Field label="Address">
          <input name="address" defaultValue={initial?.address ?? ""} className={inputCls} />
        </Field>
      </div>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="is_hosteller"
            defaultChecked={initial?.is_hosteller ?? false}
            className="h-4 w-4 accent-stone-900"
          />
          Hosteller
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="is_new_admission"
            defaultChecked={initial?.is_new_admission ?? false}
            className="h-4 w-4 accent-stone-900"
          />
          New admission
        </label>
      </div>

      {/* Bus fee amount + monthly tracking moved to the student profile —
          set it there in the "Bus Fee" card alongside the month checkboxes. */}

      <div>
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-500">Photos</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <PhotoField name="student_photo" label="Student photo" current={initial?.student_photo_url} />
          <PhotoField name="parent_photo" label="Parent photo" current={initial?.parent_photo_url} />
        </div>
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-stone-50 disabled:opacity-60"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        <Link
          href="/academics/students"
          className="rounded-lg border border-stone-200 bg-stone-100 px-4 py-2 text-sm text-stone-900 hover:bg-stone-200"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

function PhotoField({
  name,
  label,
  current,
}: {
  name: string;
  label: string;
  current?: string;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const src = preview ?? current ?? null;
  return (
    <div className="flex items-center gap-3 rounded-lg border border-stone-200 p-3">
      <div className="h-20 w-16 shrink-0 overflow-hidden rounded-md border border-stone-200 bg-stone-50">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={label} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] text-stone-400">
            No photo
          </div>
        )}
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium text-stone-600">{label}</div>
        <input
          type="file"
          name={name}
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            setPreview(f ? URL.createObjectURL(f) : null);
          }}
          className="mt-1 w-full text-xs file:mr-2 file:rounded-md file:border-0 file:bg-stone-900 file:px-2 file:py-1 file:text-xs file:text-white"
        />
        {current && !preview && <p className="mt-1 text-[10px] text-stone-400">Current photo shown.</p>}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-stone-600 mb-1">{label}</span>
      {children}
    </label>
  );
}
