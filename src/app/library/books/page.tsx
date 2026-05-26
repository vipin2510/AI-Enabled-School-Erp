import Link from "next/link";
import { requireDepartment } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addBook, deleteBook } from "../actions";
import BookImport from "./book-import";
import { ConfirmButton } from "@/components/ui/confirm-button";

export const dynamic = "force-dynamic";

type Book = {
  id: string;
  code: string;
  title: string;
  author: string | null;
  category: string | null;
  status: string;
};

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireDepartment("library");
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("books")
    .select("id, code, title, author, category, status")
    .order("title")
    .limit(500);
  if (q) query = query.or(`title.ilike.%${q}%,code.ilike.%${q}%,author.ilike.%${q}%`);
  const { data: books } = await query;

  // Which of these are currently issued?
  const ids = (books ?? []).map((b) => b.id);
  const issued = new Set<string>();
  if (ids.length) {
    const { data: loans } = await supabase
      .from("book_loans")
      .select("book_id")
      .in("book_id", ids)
      .is("returned_at", null);
    for (const l of (loans ?? []) as { book_id: string }[]) issued.add(l.book_id);
  }

  const inputCls = "rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900";

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Catalog</h1>
          <p className="mt-1 text-sm text-stone-500">{books?.length ?? 0} book(s)</p>
        </div>
        <Link href="/library/barcodes" className="text-sm text-accent hover:underline">
          Print labels →
        </Link>
      </header>

      <div className="card mb-4 space-y-4 p-5">
        <div>
          <div className="mb-2 text-sm font-semibold text-stone-800">Add a book</div>
          <form action={addBook} className="flex flex-wrap items-center gap-2">
            <input name="title" placeholder="Title *" required className={`${inputCls} w-56`} />
            <input name="author" placeholder="Author" className={`${inputCls} w-40`} />
            <input name="category" placeholder="Category" className={`${inputCls} w-36`} />
            <input name="code" placeholder="Code (auto if blank)" className={`${inputCls} w-44`} />
            <button className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800">
              Add
            </button>
          </form>
        </div>
        <div className="border-t border-stone-100 pt-4">
          <div className="mb-2 text-sm font-semibold text-stone-800">Bulk import</div>
          <BookImport />
          <p className="mt-1 text-xs text-stone-400">CSV/XLSX columns: Title (required), Author, Category, Code, ISBN.</p>
        </div>
      </div>

      <form className="mb-4" action="/library/books">
        <input name="q" defaultValue={q ?? ""} placeholder="Search title, author or code…" className={`${inputCls} w-80`} />
      </form>

      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-2 font-medium">Code</th>
              <th className="px-4 py-2 font-medium">Title</th>
              <th className="px-4 py-2 font-medium">Author</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {(books ?? []).map((b: Book) => (
              <tr key={b.id} className="border-t border-stone-100">
                <td className="px-4 py-2 font-mono text-xs">{b.code}</td>
                <td className="px-4 py-2 font-medium">{b.title}</td>
                <td className="px-4 py-2 text-stone-600">{b.author ?? "—"}</td>
                <td className="px-4 py-2">
                  {issued.has(b.id) ? (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Issued</span>
                  ) : (
                    <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">Available</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <ConfirmButton
                    action={deleteBook}
                    fields={{ id: b.id }}
                    label="Remove"
                    title="Remove book"
                    message={`Remove “${b.title}” (${b.code}) from the catalog?`}
                    disabled={issued.has(b.id)}
                  />
                </td>
              </tr>
            ))}
            {!books?.length && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-stone-500">
                  No books yet. Add one above or import a CSV.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
