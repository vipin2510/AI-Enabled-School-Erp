import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import LabelDownload from "./label-download";

export const dynamic = "force-dynamic";

export default async function BarcodesPage() {
  const profile = await requireDepartment("library");
  const schoolId = await getCurrentSchoolId(profile);
  const supabase = await createClient();
  const { count } = await supabase
    .from("books")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .eq("status", "active");

  return (
    <div className="mx-auto max-w-lg">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Print Labels</h1>
        <p className="mt-1 text-sm text-stone-500">
          Print QR labels to stick on books. Scan them at the desk to issue or return.
        </p>
      </header>
      <LabelDownload count={count ?? 0} />
    </div>
  );
}
