"use server";

import * as XLSX from "xlsx";
import { revalidatePath } from "next/cache";
import { requireDepartment } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// A short, human-typable, reasonably unique code when none is supplied.
function genCode(): string {
  return (
    "BK-" +
    Date.now().toString(36).toUpperCase().slice(-5) +
    Math.random().toString(36).toUpperCase().slice(2, 5)
  );
}

export async function saveLibrarySettings(formData: FormData) {
  await requireDepartment("library");
  const max = Math.max(1, Math.round(Number(formData.get("max_books_per_student")) || 3));
  const days = Math.max(1, Math.round(Number(formData.get("loan_days")) || 14));

  const supabase = await createClient();
  const { data: row } = await supabase.from("library_settings").select("id").limit(1).maybeSingle();
  if (row) {
    await supabase
      .from("library_settings")
      .update({ max_books_per_student: max, loan_days: days, updated_at: new Date().toISOString() })
      .eq("id", row.id);
  } else {
    await supabase.from("library_settings").insert({ max_books_per_student: max, loan_days: days });
  }
  revalidatePath("/library/settings");
}

export async function addBook(formData: FormData) {
  await requireDepartment("library");
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const supabase = await createClient();
  await supabase.from("books").insert({
    code: String(formData.get("code") ?? "").trim() || genCode(),
    title,
    author: String(formData.get("author") ?? "").trim() || null,
    isbn: String(formData.get("isbn") ?? "").trim() || null,
    category: String(formData.get("category") ?? "").trim() || null,
  });
  revalidatePath("/library/books");
}

export async function deleteBook(formData: FormData) {
  await requireDepartment("library");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("books").delete().eq("id", id);
  revalidatePath("/library/books");
}

export type ImportBooksState =
  | { error?: string; imported?: number; skipped?: number }
  | undefined;

// Import a CSV/XLSX of books. Columns (case-insensitive): Title (required),
// Code, Author, ISBN, Category. Missing codes are auto-generated.
export async function importBooksCsv(
  _prev: ImportBooksState,
  formData: FormData
): Promise<ImportBooksState> {
  await requireDepartment("library");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file to import." };

  let rows: Record<string, unknown>[];
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer" });
    rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
  } catch {
    return { error: "Could not read that file. Use the column headers Title, Author, Code, ISBN, Category." };
  }

  const pick = (r: Record<string, unknown>, ...keys: string[]) => {
    for (const k of keys) {
      const hit = Object.keys(r).find((rk) => rk.toLowerCase() === k.toLowerCase());
      if (hit) return String(r[hit] ?? "").trim();
    }
    return "";
  };

  const payload: Record<string, string | null>[] = [];
  let skipped = 0;
  for (const r of rows) {
    const title = pick(r, "title", "book", "name");
    if (!title) {
      skipped++;
      continue;
    }
    payload.push({
      code: pick(r, "code", "barcode", "id") || genCode(),
      title,
      author: pick(r, "author") || null,
      isbn: pick(r, "isbn") || null,
      category: pick(r, "category", "subject") || null,
    });
  }

  if (payload.length) {
    const supabase = await createClient();
    const { error } = await supabase
      .from("books")
      .upsert(payload, { onConflict: "code", ignoreDuplicates: true });
    if (error) return { error: error.message };
  }
  revalidatePath("/library/books");
  revalidatePath("/library/barcodes");
  return { imported: payload.length, skipped };
}

// --- Book requests (acquisition wishlist) -------------------------------

export async function addBookRequest(formData: FormData) {
  await requireDepartment("library");
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const supabase = await createClient();
  await supabase.from("book_requests").insert({
    title,
    author: String(formData.get("author") ?? "").trim() || null,
    requested_for: String(formData.get("requested_for") ?? "").trim() || null,
    note: String(formData.get("note") ?? "").trim() || null,
  });
  revalidatePath("/library/dashboard");
}

// Mark a requested title as acquired (or reopen it).
export async function setBookRequestStatus(formData: FormData) {
  await requireDepartment("library");
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") === "fulfilled" ? "fulfilled" : "open";
  if (!id) return;
  const supabase = await createClient();
  await supabase
    .from("book_requests")
    .update({ status, fulfilled_at: status === "fulfilled" ? new Date().toISOString() : null })
    .eq("id", id);
  revalidatePath("/library/dashboard");
}

export async function deleteBookRequest(formData: FormData) {
  await requireDepartment("library");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("book_requests").delete().eq("id", id);
  revalidatePath("/library/dashboard");
}

export type DeskResult = { ok?: boolean; message?: string; error?: string };

// Issue a book copy to a student: validate the code, ensure it isn't already
// out, and enforce the per-student cap. Due date = today + loan_days.
export async function issueBook(code: string, studentId: string): Promise<DeskResult> {
  await requireDepartment("library");
  if (!code.trim() || !studentId) return { error: "Pick a book and a student." };
  const supabase = await createClient();

  const { data: book } = await supabase
    .from("books")
    .select("id, title, status")
    .eq("code", code.trim())
    .maybeSingle();
  if (!book) return { error: "No book found for that code." };
  if (book.status !== "active") return { error: `This book is marked ${book.status}.` };

  const { data: openLoan } = await supabase
    .from("book_loans")
    .select("id")
    .eq("book_id", book.id)
    .is("returned_at", null)
    .maybeSingle();
  if (openLoan) return { error: "This book is already issued." };

  const { data: settings } = await supabase
    .from("library_settings")
    .select("max_books_per_student, loan_days")
    .limit(1)
    .maybeSingle();
  const max = settings?.max_books_per_student ?? 3;
  const loanDays = settings?.loan_days ?? 14;

  const { count } = await supabase
    .from("book_loans")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId)
    .is("returned_at", null);
  if ((count ?? 0) >= max) {
    return { error: `Student is at the limit of ${max} book(s). Return one first.` };
  }

  const due = new Date();
  due.setDate(due.getDate() + loanDays);
  const { error } = await supabase.from("book_loans").insert({
    book_id: book.id,
    student_id: studentId,
    due_date: due.toISOString().slice(0, 10),
  });
  if (error) return { error: error.message };

  revalidatePath("/library");
  return { ok: true, message: `Issued “${book.title}”. Due ${due.toISOString().slice(0, 10)}.` };
}

export async function returnBook(code: string): Promise<DeskResult> {
  await requireDepartment("library");
  if (!code.trim()) return { error: "Scan or enter a book code." };
  const supabase = await createClient();

  const { data: book } = await supabase
    .from("books")
    .select("id, title")
    .eq("code", code.trim())
    .maybeSingle();
  if (!book) return { error: "No book found for that code." };

  const { data: loan } = await supabase
    .from("book_loans")
    .select("id")
    .eq("book_id", book.id)
    .is("returned_at", null)
    .maybeSingle();
  if (!loan) return { error: "This book is not currently issued." };

  const { error } = await supabase
    .from("book_loans")
    .update({ returned_at: new Date().toISOString() })
    .eq("id", loan.id);
  if (error) return { error: error.message };

  revalidatePath("/library");
  return { ok: true, message: `Returned “${book.title}”.` };
}
