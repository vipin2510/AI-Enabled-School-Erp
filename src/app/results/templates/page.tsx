import Link from "next/link";
import { requireRole } from "@/lib/auth";
import {
  listTemplates,
  createTemplate,
  cloneTemplate,
  deleteTemplate,
  setDefaultTemplate,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function ResultTemplatesPage() {
  // Layer 1 + Layer 2 only (server actions re-check, but we gate the UI
  // too so staff don't see the link at all).
  await requireRole("admin", "manager");
  const templates = await listTemplates();

  return (
    <div className="max-w-5xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Result card templates</h1>
          <p className="text-sm text-stone-500">
            Edit the layout of the report card with a drag-and-drop editor. The
            template marked as default is used everywhere downloads happen.
          </p>
        </div>
        <form action={createTemplate} className="flex gap-2">
          <input
            name="name"
            required
            placeholder="New template name"
            className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
          />
          <select
            name="page_size"
            defaultValue="a4-portrait"
            className="rounded-lg border border-stone-300 bg-white px-2 py-2 text-sm"
          >
            <option value="a4-portrait">A4 portrait</option>
            <option value="a4-landscape">A4 landscape</option>
          </select>
          <button className="rounded-lg bg-stone-900 px-3 py-2 text-sm font-medium text-stone-50">
            + New
          </button>
        </form>
      </header>

      {templates.length === 0 ? (
        <div className="card p-6 text-sm text-stone-500">
          No templates yet. Apply migration{" "}
          <span className="font-mono text-xs">0022_result_templates.sql</span> to
          seed the starter set.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <div
              key={t.id}
              className={
                "card flex flex-col gap-3 p-5 " +
                (t.is_default ? "border-emerald-300 ring-1 ring-emerald-200" : "")
              }
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-stone-900">{t.name}</div>
                  <div className="mt-0.5 text-xs uppercase tracking-wide text-stone-500">
                    {t.page_size === "a4-portrait" ? "A4 portrait" : "A4 landscape"}
                  </div>
                </div>
                {t.is_default && (
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    Default
                  </span>
                )}
              </div>

              {t.description && (
                <p className="text-xs text-stone-600 line-clamp-3">{t.description}</p>
              )}

              <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-500">
                {t.layout.length === 0
                  ? "Empty layout — falls back to the standard report card."
                  : `${t.layout.length} block${t.layout.length === 1 ? "" : "s"}`}
              </div>

              <div className="mt-auto flex flex-wrap gap-2">
                <Link
                  href={`/results/templates/${t.id}/edit`}
                  className="rounded-lg bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-800"
                >
                  Edit
                </Link>
                {!t.is_default && (
                  <form action={setDefaultTemplate}>
                    <input type="hidden" name="id" value={t.id} />
                    <button className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50">
                      Set as default
                    </button>
                  </form>
                )}
                <form action={cloneTemplate}>
                  <input type="hidden" name="source_id" value={t.id} />
                  <button className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50">
                    Duplicate
                  </button>
                </form>
                {!t.is_default && templates.length > 1 && (
                  <form action={deleteTemplate}>
                    <input type="hidden" name="id" value={t.id} />
                    <button className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-100">
                      Delete
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
