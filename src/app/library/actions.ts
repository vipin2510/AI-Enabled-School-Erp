"use server";

import * as XLSX from "xlsx";
import { revalidatePath } from "next/cache";
import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayStr, addDays } from "@/lib/attendance";

// Library IDs are numeric only (the librarian types them at the desk). When
// none is supplied we hand out the next number after the largest existing one,
// padded to 4 digits so the first batch is 1001, 1002, …
async function nextBookCode(schoolId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.from("books").select("code").eq("school_id", schoolId);
  let max = 1000;
  for (const row of (data ?? []) as { code: string | null }[]) {
    const n = Number((row.code ?? "").replace(/\D+/g, ""));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return String(max + 1);
}

const onlyDigits = (s: string) => s.replace(/\D+/g, "");

export async function saveLibrarySettings(formData: FormData) {
  const profile = await requireDepartment("library");
  const schoolId = await getCurrentSchoolId(profile);
  const max = Math.max(1, Math.round(Number(formData.get("max_books_per_student")) || 3));
  const days = Math.max(1, Math.round(Number(formData.get("loan_days")) || 14));

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("library_settings")
    .select("id")
    .eq("school_id", schoolId)
    .limit(1)
    .maybeSingle();
  if (row) {
    await supabase
      .from("library_settings")
      .update({ max_books_per_student: max, loan_days: days, updated_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("school_id", schoolId);
  } else {
    await supabase.from("library_settings").insert({ max_books_per_student: max, loan_days: days, school_id: schoolId });
  }
  revalidatePath("/library/settings");
}

export async function addBook(formData: FormData) {
  const profile = await requireDepartment("library");
  const schoolId = await getCurrentSchoolId(profile);
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const supabase = await createClient();
  const typedCode = onlyDigits(String(formData.get("code") ?? ""));
  await supabase.from("books").insert({
    code: typedCode || (await nextBookCode(schoolId)),
    title,
    author: String(formData.get("author") ?? "").trim() || null,
    isbn: String(formData.get("isbn") ?? "").trim() || null,
    category: String(formData.get("category") ?? "").trim() || null,
    school_id: schoolId,
  });
  revalidatePath("/library/books");
}

export async function deleteBook(formData: FormData) {
  const profile = await requireDepartment("library");
  const schoolId = await getCurrentSchoolId(profile);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("books").delete().eq("id", id).eq("school_id", schoolId);
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
  const profile = await requireDepartment("library");
  const schoolId = await getCurrentSchoolId(profile);
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
  // Number imported books off the current max, so a single CSV doesn't collide
  // with itself when several rows omit a code.
  let nextSeq = Number((await nextBookCode(schoolId))) || 1001;
  for (const r of rows) {
    const title = pick(r, "title", "book", "name");
    if (!title) {
      skipped++;
      continue;
    }
    const typedCode = onlyDigits(pick(r, "code", "barcode", "id"));
    const code = typedCode || String(nextSeq++);
    payload.push({
      code,
      title,
      author: pick(r, "author") || null,
      isbn: pick(r, "isbn") || null,
      category: pick(r, "category", "subject") || null,
      school_id: schoolId,
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
  const profile = await requireDepartment("library");
  const schoolId = await getCurrentSchoolId(profile);
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const supabase = await createClient();
  await supabase.from("book_requests").insert({
    title,
    author: String(formData.get("author") ?? "").trim() || null,
    requested_for: String(formData.get("requested_for") ?? "").trim() || null,
    note: String(formData.get("note") ?? "").trim() || null,
    school_id: schoolId,
  });
  revalidatePath("/library/dashboard");
}

// Mark a requested title as acquired (or reopen it).
export async function setBookRequestStatus(formData: FormData) {
  const profile = await requireDepartment("library");
  const schoolId = await getCurrentSchoolId(profile);
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") === "fulfilled" ? "fulfilled" : "open";
  if (!id) return;
  const supabase = await createClient();
  await supabase
    .from("book_requests")
    .update({ status, fulfilled_at: status === "fulfilled" ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("school_id", schoolId);
  revalidatePath("/library/dashboard");
}

export async function deleteBookRequest(formData: FormData) {
  const profile = await requireDepartment("library");
  const schoolId = await getCurrentSchoolId(profile);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("book_requests").delete().eq("id", id).eq("school_id", schoolId);
  revalidatePath("/library/dashboard");
}

export type DeskResult = { ok?: boolean; message?: string; error?: string };

// Issue a book copy to a student: validate the code, ensure it isn't already
// out, and enforce the per-student cap. Due date = today + loan_days.
export async function issueBook(code: string, studentId: string): Promise<DeskResult> {
  const profile = await requireDepartment("library");
  const schoolId = await getCurrentSchoolId(profile);
  const normalised = onlyDigits(code);
  if (!normalised || !studentId) return { error: "Pick a book and a student." };
  const supabase = await createClient();

  const { data: book } = await supabase
    .from("books")
    .select("id, title, status")
    .eq("school_id", schoolId)
    .eq("code", normalised)
    .maybeSingle();
  if (!book) return { error: "No book found for that number." };
  if (book.status !== "active") return { error: `This book is marked ${book.status}.` };

  const { data: openLoan } = await supabase
    .from("book_loans")
    .select("id")
    .eq("school_id", schoolId)
    .eq("book_id", book.id)
    .is("returned_at", null)
    .maybeSingle();
  if (openLoan) return { error: "This book is already issued." };

  const { data: settings } = await supabase
    .from("library_settings")
    .select("max_books_per_student, loan_days")
    .eq("school_id", schoolId)
    .limit(1)
    .maybeSingle();
  const max = settings?.max_books_per_student ?? 3;
  const loanDays = settings?.loan_days ?? 14;

  const { count } = await supabase
    .from("book_loans")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .is("returned_at", null);
  if ((count ?? 0) >= max) {
    return { error: `Student is at the limit of ${max} book(s). Return one first.` };
  }

  const due = addDays(todayStr(), loanDays);
  const { error } = await supabase.from("book_loans").insert({
    book_id: book.id,
    student_id: studentId,
    due_date: due,
    school_id: schoolId,
  });
  if (error) return { error: error.message };

  // Pull the student's name + their new lifetime total so the desk can echo
  // "Issued to <name> · 7 borrowed all-time" instead of a context-free toast.
  const [{ data: student }, { count: lifetime }] = await Promise.all([
    supabase.from("students").select("full_name").eq("school_id", schoolId).eq("id", studentId).maybeSingle(),
    supabase
      .from("book_loans")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("student_id", studentId),
  ]);

  revalidatePath("/library");
  revalidatePath("/library/dashboard");
  revalidatePath(`/academics/students/${studentId}`);
  const name = student?.full_name ?? "student";
  return {
    ok: true,
    message: `Issued “${book.title}” to ${name}. Due ${due}. (${lifetime ?? 0} borrowed all-time)`,
  };
}

export async function returnBook(code: string): Promise<DeskResult> {
  const profile = await requireDepartment("library");
  const schoolId = await getCurrentSchoolId(profile);
  const normalised = onlyDigits(code);
  if (!normalised) return { error: "Scan or enter a book number." };
  const supabase = await createClient();

  const { data: book } = await supabase
    .from("books")
    .select("id, title")
    .eq("school_id", schoolId)
    .eq("code", normalised)
    .maybeSingle();
  if (!book) return { error: "No book found for that number." };

  const { data: loan } = await supabase
    .from("book_loans")
    .select("id, student_id, students(full_name)")
    .eq("school_id", schoolId)
    .eq("book_id", book.id)
    .is("returned_at", null)
    .maybeSingle();
  if (!loan) return { error: "This book is not currently issued." };

  const { error } = await supabase
    .from("book_loans")
    .update({ returned_at: new Date().toISOString() })
    .eq("id", loan.id)
    .eq("school_id", schoolId);
  if (error) return { error: error.message };

  const studentId = (loan as { student_id: string | null }).student_id;
  const studentName =
    (loan as unknown as { students: { full_name: string } | null }).students?.full_name ?? "student";

  let lifetime = 0;
  if (studentId) {
    const { count } = await supabase
      .from("book_loans")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("student_id", studentId);
    lifetime = count ?? 0;
  }

  revalidatePath("/library");
  revalidatePath("/library/dashboard");
  if (studentId) revalidatePath(`/academics/students/${studentId}`);
  return {
    ok: true,
    message: `Collected “${book.title}” from ${studentName}. (${lifetime} borrowed all-time)`,
  };
}
