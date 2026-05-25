import { requireDepartment } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ResultsPage() {
  await requireDepartment("results");
  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Results</h1>
        <p className="text-stone-500 text-sm">Department workspace.</p>
      </header>
      <div className="card p-8 text-center text-stone-500">
        <p className="text-base font-medium text-stone-700">Results module coming soon</p>
        <p className="mt-1 text-sm">
          Exam marks entry, grade cards and report generation will live here.
        </p>
      </div>
    </div>
  );
}
