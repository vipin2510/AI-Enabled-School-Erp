"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inr } from "@/lib/utils";
import { saveStructureUpdates } from "./actions";

type Component = {
  id: string;
  label: string;
  kind: string;
  amount: number;
  period_index: number | null;
};

export type Structure = {
  id: string;
  academic_year: string;
  scope: "school" | "hostel";
  group_label: string | null;
  student_kind: "new" | "old" | "any";
  total_amount: number;
  classes: { display_name: string; ordinal: number } | null;
  fee_structure_components: Component[];
};

// Map a structure's components to the editable fields shown in the table.
function comp(s: Structure, kind: string, period?: number) {
  return s.fee_structure_components.find(
    (c) => c.kind === kind && (period === undefined || c.period_index === period)
  );
}
function monthlyComps(s: Structure) {
  return s.fee_structure_components.filter((c) => c.kind === "monthly");
}

export default function StructuresEditor({ structures }: { structures: Structure[] }) {
  const school = useMemo(
    () =>
      structures
        .filter((s) => s.scope === "school")
        .sort((a, b) => (a.classes?.ordinal ?? 0) - (b.classes?.ordinal ?? 0)),
    [structures]
  );
  const hostel = useMemo(
    () =>
      structures
        .filter((s) => s.scope === "hostel")
        .sort(
          (a, b) =>
            (a.group_label ?? "").localeCompare(b.group_label ?? "") ||
            a.student_kind.localeCompare(b.student_kind)
        ),
    [structures]
  );

  // edits keyed by `${structureId}:${field}` -> string value
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const key = (sid: string, field: string) => `${sid}:${field}`;

  const valueOf = (sid: string, field: string, fallback: number) => {
    const k = key(sid, field);
    return k in edits ? edits[k] : String(fallback ?? 0);
  };

  const setValue = (sid: string, field: string, v: string) =>
    setEdits((prev) => ({ ...prev, [key(sid, field)]: v }));

  const num = (sid: string, field: string, fallback: number) => {
    const n = Number(valueOf(sid, field, fallback));
    return Number.isFinite(n) ? n : 0;
  };

  const dirty = Object.keys(edits).length > 0;

  // Live annual total for a school row using current (possibly edited) values.
  const schoolTotal = (s: Structure) => {
    const monthly = num(s.id, "monthly", monthlyComps(s)[0]?.amount ?? 0);
    const yearly = num(s.id, "yearly", comp(s, "yearly")?.amount ?? 0);
    return yearly + monthly * 12;
  };
  const hostelTotal = (s: Structure) =>
    [1, 2, 3, 4].reduce(
      (sum, n) => sum + num(s.id, `inst${n}`, comp(s, "instalment", n)?.amount ?? 0),
      0
    );

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      // Collect edits as (structure_id, component_id, amount) — the server
      // verifies each pair belongs to the caller's school before writing.
      const componentsPayload: { structure_id: string; component_id: string; amount: number }[] = [];
      const structuresPayload: { structure_id: string; total_amount: number }[] = [];
      const all = [...school, ...hostel];

      for (const s of all) {
        const pushIf = (c: Component | undefined, field: string) => {
          if (!c) return;
          const k = key(s.id, field);
          if (k in edits) {
            componentsPayload.push({
              structure_id: s.id,
              component_id: c.id,
              amount: num(s.id, field, c.amount),
            });
          }
        };

        let structureTouched = false;
        if (s.scope === "school") {
          const before = componentsPayload.length;
          pushIf(comp(s, "registration"), "registration");
          pushIf(comp(s, "admission_one_time"), "admission_one_time");
          pushIf(comp(s, "yearly"), "yearly");
          pushIf(comp(s, "caution"), "caution");
          if (key(s.id, "monthly") in edits) {
            const amt = num(s.id, "monthly", monthlyComps(s)[0]?.amount ?? 0);
            for (const m of monthlyComps(s)) {
              componentsPayload.push({
                structure_id: s.id,
                component_id: m.id,
                amount: amt,
              });
            }
          }
          structureTouched = componentsPayload.length > before;
        } else {
          const before = componentsPayload.length;
          pushIf(comp(s, "registration"), "registration");
          pushIf(comp(s, "caution"), "caution");
          for (const n of [1, 2, 3, 4]) pushIf(comp(s, "instalment", n), `inst${n}`);
          structureTouched = componentsPayload.length > before;
        }

        if (structureTouched) {
          structuresPayload.push({
            structure_id: s.id,
            total_amount: s.scope === "school" ? schoolTotal(s) : hostelTotal(s),
          });
        }
      }

      if (componentsPayload.length === 0 && structuresPayload.length === 0) {
        setSaving(false);
        return;
      }

      const result = await saveStructureUpdates({
        components: componentsPayload,
        structures: structuresPayload,
      });
      if (!result.ok) throw new Error(result.error);

      setSavedAt(new Date().toLocaleTimeString());
      setEdits({});
      setTimeout(() => window.location.reload(), 400);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const Cell = ({ sid, field, value }: { sid: string; field: string; value: number }) => (
    <Input
      type="number"
      className="w-24 text-right py-1"
      value={valueOf(sid, field, value)}
      onChange={(e) => setValue(sid, field, e.target.value)}
    />
  );

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <p className="text-stone-500 text-sm">
          Edit any amount and Save. These are the source values used when collecting fees.
        </p>
        <div className="flex items-center gap-3">
          {error && <span className="text-sm text-red-600">{error}</span>}
          {savedAt && !dirty && (
            <span className="text-sm text-green-700">Saved at {savedAt}</span>
          )}
          <Button onClick={save} disabled={!dirty || saving}>
            {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </Button>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-medium mb-3">School Fees</h2>
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-stone-500 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Class</th>
                <th className="px-4 py-2 font-medium text-right">Reg.</th>
                <th className="px-4 py-2 font-medium text-right">New Adm.</th>
                <th className="px-4 py-2 font-medium text-right">Yearly</th>
                <th className="px-4 py-2 font-medium text-right">Monthly</th>
                <th className="px-4 py-2 font-medium text-right">Caution</th>
                <th className="px-4 py-2 font-medium text-right">Annual Total</th>
              </tr>
            </thead>
            <tbody>
              {school.map((s) => (
                <tr key={s.id} className="border-t border-stone-100">
                  <td className="px-4 py-2 font-medium whitespace-nowrap">
                    {s.classes?.display_name}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Cell sid={s.id} field="registration" value={comp(s, "registration")?.amount ?? 0} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Cell sid={s.id} field="admission_one_time" value={comp(s, "admission_one_time")?.amount ?? 0} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Cell sid={s.id} field="yearly" value={comp(s, "yearly")?.amount ?? 0} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Cell sid={s.id} field="monthly" value={monthlyComps(s)[0]?.amount ?? 0} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Cell sid={s.id} field="caution" value={comp(s, "caution")?.amount ?? 0} />
                  </td>
                  <td className="px-4 py-2 text-right font-semibold whitespace-nowrap">
                    {inr(schoolTotal(s))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">Hostel Fees</h2>
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-stone-500 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Group</th>
                <th className="px-4 py-2 font-medium">Kind</th>
                <th className="px-4 py-2 font-medium text-right">Reg.</th>
                <th className="px-4 py-2 font-medium text-right">Caution</th>
                <th className="px-4 py-2 font-medium text-right">1st Inst.</th>
                <th className="px-4 py-2 font-medium text-right">2nd Inst.</th>
                <th className="px-4 py-2 font-medium text-right">3rd Inst.</th>
                <th className="px-4 py-2 font-medium text-right">4th Inst.</th>
                <th className="px-4 py-2 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {hostel.map((s) => (
                <tr key={s.id} className="border-t border-stone-100">
                  <td className="px-4 py-2 font-medium whitespace-nowrap">{s.group_label}</td>
                  <td className="px-4 py-2 capitalize">{s.student_kind}</td>
                  <td className="px-4 py-2 text-right">
                    <Cell sid={s.id} field="registration" value={comp(s, "registration")?.amount ?? 0} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Cell sid={s.id} field="caution" value={comp(s, "caution")?.amount ?? 0} />
                  </td>
                  {[1, 2, 3, 4].map((n) => (
                    <td key={n} className="px-4 py-2 text-right">
                      <Cell sid={s.id} field={`inst${n}`} value={comp(s, "instalment", n)?.amount ?? 0} />
                    </td>
                  ))}
                  <td className="px-4 py-2 text-right font-semibold whitespace-nowrap">
                    {inr(hostelTotal(s))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
