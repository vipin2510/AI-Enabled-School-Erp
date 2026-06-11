"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { createClient } from "@/lib/supabase/client";
import { bustLateFeeCache } from "./actions";

type Settings = {
  id: string | null;
  per_day_amount: number;
  grace_days: number;
  is_enabled: boolean;
  monthly_due_day: number;
};

export default function LateFeeForm({ settings, schoolId }: { settings: Settings; schoolId: string }) {
  const [amount, setAmount] = useState(String(settings.per_day_amount));
  const [grace, setGrace] = useState(String(settings.grace_days));
  const [dueDay, setDueDay] = useState(String(settings.monthly_due_day));
  const [enabled, setEnabled] = useState(settings.is_enabled);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const day = Math.min(28, Math.max(1, Number(dueDay) || 10));
    const payload = {
      per_day_amount: Number(amount),
      grace_days: Number(grace),
      monthly_due_day: day,
      is_enabled: enabled,
      updated_at: new Date().toISOString(),
    };
    const run = (body: typeof payload | Omit<typeof payload, "monthly_due_day">) =>
      settings.id
        ? supabase.from("late_fee_settings").update(body).eq("id", settings.id).eq("school_id", schoolId)
        : supabase.from("late_fee_settings").insert({ ...body, school_id: schoolId });

    const first = await run(payload);
    if (first.error && /monthly_due_day/.test(first.error.message)) {
      // Migration 0004 not applied yet — the column is missing. Retry without it.
      const { monthly_due_day: _omit, ...rest } = payload;
      void _omit;
      const retry = await run(rest);
      if (retry.error) setError(retry.error.message);
      else setError("Saved, but run migration 0004 to persist the monthly due day.");
    } else if (first.error) {
      setError(first.error.message);
    } else {
      // Settings are cached on the Collect Fee page for 30 min; force a flush
      // so the cashier sees the new rate immediately. Best-effort — a failed
      // bust just means the page picks the new value up at next TTL.
      try { await bustLateFeeCache(); } catch { /* fall through to TTL */ }
      setSavedAt(new Date().toLocaleTimeString());
    }
    setSaving(false);
  };

  return (
    <div className="card p-6 space-y-5">
      <Toggle
        checked={enabled}
        onChange={setEnabled}
        label="Enable late fee"
        description="If off, no penalty is applied even after due date."
      />

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <div className="text-sm font-medium mb-1">Per-day penalty (₹)</div>
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min={0}
          />
        </label>
        <label className="block">
          <div className="text-sm font-medium mb-1">Grace days</div>
          <Input
            type="number"
            value={grace}
            onChange={(e) => setGrace(e.target.value)}
            min={0}
          />
        </label>
      </div>

      <label className="block">
        <div className="text-sm font-medium mb-1">Monthly fee due day</div>
        <Input
          type="number"
          value={dueDay}
          onChange={(e) => setDueDay(e.target.value)}
          min={1}
          max={28}
        />
        <p className="text-xs text-stone-500 mt-1">
          The last date to pay each month&apos;s fee (1–28). Late fee accrues per day after this.
        </p>
      </label>

      {error && <div className="text-sm text-red-600">{error}</div>}
      {savedAt && <div className="text-sm text-green-700">Saved at {savedAt}</div>}

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
