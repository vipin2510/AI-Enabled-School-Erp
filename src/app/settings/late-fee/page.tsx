import { createClient } from "@/lib/supabase/server";
import LateFeeForm from "./late-fee-form";

export const dynamic = "force-dynamic";

export default async function LateFeeSettingsPage() {
  const supabase = await createClient();

  // monthly_due_day may not exist before migration 0004; fall back gracefully.
  let settings = {
    id: null as string | null,
    per_day_amount: 100,
    grace_days: 0,
    is_enabled: true,
    monthly_due_day: 10,
  };
  const withDay = await supabase
    .from("late_fee_settings")
    .select("id, per_day_amount, grace_days, is_enabled, monthly_due_day")
    .maybeSingle();
  if (!withDay.error && withDay.data) {
    settings = { ...settings, ...withDay.data };
  } else {
    const basic = await supabase
      .from("late_fee_settings")
      .select("id, per_day_amount, grace_days, is_enabled")
      .maybeSingle();
    if (basic.data) settings = { ...settings, ...basic.data };
  }

  return (
    <div className="max-w-xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Late Fee Settings</h1>
        <p className="text-stone-500 text-sm">
          Penalty automatically computed per day past the monthly due date.
        </p>
      </header>
      <LateFeeForm settings={settings} />
    </div>
  );
}
