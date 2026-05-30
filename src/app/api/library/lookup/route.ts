import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/library/lookup?code=CODE
// Returns the book and, if currently issued, the open loan + borrower.
export async function GET(req: Request) {
  const profile = await requireDepartment("library");
  const schoolId = await getCurrentSchoolId(profile);
  const code = (new URL(req.url).searchParams.get("code") ?? "").trim();
  if (!code) return NextResponse.json({ book: null, loan: null });

  const supabase = await createClient();
  const { data: book } = await supabase
    .from("books")
    .select("id, code, title, author, category, status")
    .eq("school_id", schoolId)
    .eq("code", code)
    .maybeSingle();

  if (!book) return NextResponse.json({ book: null, loan: null });

  const { data: loan } = await supabase
    .from("book_loans")
    .select("id, issued_at, due_date, students(id, full_name, section, classes(display_name))")
    .eq("school_id", schoolId)
    .eq("book_id", book.id)
    .is("returned_at", null)
    .maybeSingle();

  return NextResponse.json({ book, loan: loan ?? null });
}
