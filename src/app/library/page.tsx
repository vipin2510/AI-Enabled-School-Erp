import { requireDepartment } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  await requireDepartment("library");
  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
        <p className="text-stone-500 text-sm">Department workspace.</p>
      </header>
      <div className="card p-8 text-center text-stone-500">
        <p className="text-base font-medium text-stone-700">Library module coming soon</p>
        <p className="mt-1 text-sm">
          Catalog, issue/return and member management will live here.
        </p>
      </div>
    </div>
  );
}
