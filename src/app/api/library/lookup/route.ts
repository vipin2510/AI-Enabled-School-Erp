import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/library/lookup?code=QUERY
// Resolves a book for the issue/return desk. The query can be:
//   • a full code as printed/scanned on the label  → "SAN-4525"
//   • just the accession number from the register   → "4525"
//   • part of the title                             → "sanskrit"
// Because accession numbers overlap across registers (codes are
// PREFIX-<accession>), a bare number can match several books — so this
// returns a LIST of candidates, each with its current loan, and the desk
// asks the operator to pick. A verbatim full-code match short-circuits to one.
export async function GET(req: Request) {
  const profile = await requireDepartment("library");
  const schoolId = await getCurrentSchoolId(profile);
  const raw = (new URL(req.url).searchParams.get("code") ?? "").trim();
  if (!raw) return NextResponse.json({ books: [] });

  const supabase = await createClient();
  const digits = raw.replace(/\D/g, "");
  // Sanitise for PostgREST's or() grammar — commas/parens/stars would break it.
  const safe = raw.replace(/[,()*]/g, " ").trim();

  // Match: the code typed verbatim, the code ending in the accession number
  // (PREFIX-4525), a legacy all-digits code, or the title containing the text.
  const ors = [`code.ilike.${safe}`];
  if (digits) {
    ors.push(`code.eq.${digits}`);
    ors.push(`code.ilike.%-${digits}`); // PREFIX-4525
    ors.push(`code.ilike.%-${digits}-%`); // PREFIX-4525-2 (duplicate copy)
  }
  if (safe.length >= 2) ors.push(`title.ilike.%${safe}%`);

  const { data: matches } = await supabase
    .from("books")
    .select("id, code, title, author, category, status")
    .eq("school_id", schoolId)
    .or(ors.join(","))
    .limit(25);

  const all = matches ?? [];
  // A verbatim full-code match is unambiguous — return just that one.
  const exact = all.find((b) => b.code.toLowerCase() === raw.toLowerCase());
  const list = exact ? [exact] : all;
  if (list.length === 0) return NextResponse.json({ books: [] });

  // Attach the open loan (if any) for each candidate in one query.
  const ids = list.map((b) => b.id);
  const { data: loans } = await supabase
    .from("book_loans")
    .select("id, issued_at, due_date, book_id, students(id, full_name, section, classes(display_name))")
    .eq("school_id", schoolId)
    .in("book_id", ids)
    .is("returned_at", null);
  const loanByBook = new Map((loans ?? []).map((l) => [l.book_id, l]));

  const books = list.map((b) => ({ ...b, loan: loanByBook.get(b.id) ?? null }));
  return NextResponse.json({ books });
}
