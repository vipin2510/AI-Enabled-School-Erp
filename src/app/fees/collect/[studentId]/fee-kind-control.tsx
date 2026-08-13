"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setFeeKind } from "../actions";

// Compact New/Old selector shown in the Collect header. Sets students.fee_kind,
// which gates one-time charges. First-time set is allowed for any fees user;
// once set, only an admin can change it (enforced in the action too). On save we
// refresh so the form re-gates registration/admission items.
export default function FeeKindControl({
  studentId,
  current,
  isAdmin,
}: {
  studentId: string;
  current: "new" | "old" | null;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState<"new" | "old">(current ?? "old");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locked = current != null && !isAdmin;

  async function save() {
    if (value === current) return;
    setPending(true);
    setError(null);
    const fd = new FormData();
    fd.set("student_id", studentId);
    fd.set("fee_kind", value);
    const res = await setFeeKind(undefined, fd);
    setPending(false);
    if (res?.error) { setError(res.error); return; }
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-left">
      <div className="text-[10px] uppercase tracking-wide text-stone-500">
        Fee type {current == null && <span className="text-amber-600">· not set</span>}
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        <select
          value={value}
          disabled={locked || pending}
          onChange={(e) => setValue(e.target.value as "new" | "old")}
          className="rounded-md border border-stone-300 bg-white px-2 py-1 text-sm disabled:opacity-60"
        >
          <option value="new">New</option>
          <option value="old">Old</option>
        </select>
        {!locked && value !== current && (
          <button type="button" onClick={save} disabled={pending}
            className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs text-stone-700 hover:bg-stone-50 disabled:opacity-50">
            {pending ? "…" : "Save"}
          </button>
        )}
      </div>
      {locked && <div className="mt-0.5 text-[10px] text-stone-400">Admin only to change</div>}
      {error && <div className="mt-0.5 text-[10px] text-red-600">{error}</div>}
    </div>
  );
}
