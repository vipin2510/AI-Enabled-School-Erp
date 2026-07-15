import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import { BookLabelSheet, type BookLabel } from "@/components/book-label-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/library/labels?perPage=12&ids=a,b,c
// QR labels (with the code printed below) for printing & sticking on books.
// Without `ids`, all active books are included.
export async function GET(req: Request) {
  const profile = await requireDepartment("library");
  const schoolId = await getCurrentSchoolId(profile);
  const url = new URL(req.url);
  const perPage = Math.max(1, Math.min(40, Math.round(Number(url.searchParams.get("perPage")) || 12)));
  const idsParam = url.searchParams.get("ids");

  // Upper bound on labels rendered per invocation: a QR is generated for every
  // book and the whole sheet is serialised synchronously (@react-pdf is
  // CPU-bound). The `ids` path stays bounded by the selection; the "all active
  // books" fallback is the one that can balloon on a large library.
  const MAX_LABELS = 240; // 20 pages at 12/page

  const supabase = await createClient();
  let q = supabase.from("books").select("code, title").eq("school_id", schoolId).eq("status", "active").order("created_at", { ascending: false });
  if (idsParam) q = q.in("id", idsParam.split(",").filter(Boolean));
  q = q.limit(MAX_LABELS + 1);
  const { data: books } = await q;

  if (!books || books.length === 0) {
    return NextResponse.json({ error: "No books to print labels for." }, { status: 404 });
  }
  if (books.length > MAX_LABELS) {
    return NextResponse.json(
      { error: `Too many books (${MAX_LABELS}+) for one label sheet. Select specific books to print.` },
      { status: 413 }
    );
  }

  const labels: BookLabel[] = await Promise.all(
    books.map(async (b) => ({
      code: b.code,
      title: b.title,
      qrDataUrl: await QRCode.toDataURL(b.code, { margin: 0, width: 200 }),
    }))
  );

  const buf = await renderToBuffer(BookLabelSheet({ labels, perPage }) as never);
  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="library-labels.pdf"`,
    },
  });
}
