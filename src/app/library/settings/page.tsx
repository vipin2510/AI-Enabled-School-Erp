import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { saveLibrarySettings } from "../actions";

export const dynamic = "force-dynamic";

export default async function LibrarySettingsPage() {
  const profile = await requireDepartment("library");
  const schoolId = await getCurrentSchoolId(profile);
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("library_settings")
    .select("max_books_per_student, loan_days")
    .eq("school_id", schoolId)
    .limit(1)
    .maybeSingle();

  const max = settings?.max_books_per_student ?? 3;
  const days = settings?.loan_days ?? 14;
  const field = "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900";

  return (
    <div className="mx-auto max-w-lg">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Library Settings</h1>
        <p className="mt-1 text-sm text-stone-500">Borrowing rules applied at the issue desk.</p>
      </header>

      <form action={saveLibrarySettings} className="card space-y-4 p-5">
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-600">
            Maximum books a student can hold at once
          </label>
          <input type="number" name="max_books_per_student" min={1} max={50} defaultValue={max} className={field} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-600">
            Days a book can be issued for
          </label>
          <input type="number" name="loan_days" min={1} max={365} defaultValue={days} className={field} />
        </div>
        <button className="rounded-lg bg-stone-900 px-5 py-2 text-sm font-medium text-white hover:bg-stone-800">
          Save settings
        </button>
      </form>
    </div>
  );
}
