import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import { BookLabelSheet, type BookLabel } from "@/components/book-label-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Per-request cap on labels. A QR is generated for every book and the whole
// sheet is serialised synchronously (@react-pdf is CPU-bound), so a huge
// library must be printed in batches rather than one giant PDF that times out.
const BATCH_SIZE = 300;

// GET /api/library/labels?perPage=12&offset=0&q=search&ids=a,b,c
// QR labels (with the code printed below) for printing & sticking on books.
// Without `ids`, active books are returned one BATCH_SIZE slice at a time,
// ordered by code so consecutive batches cover the whole library with no gaps.
export async function GET(req: Request) {
  const profile = await requireDepartment("library");
  const schoolId = await getCurrentSchoolId(profile);
  const url = new URL(req.url);
  const perPage = Math.max(1, Math.min(40, Math.round(Number(url.searchParams.get("perPage")) || 12)));
  const idsParam = url.searchParams.get("ids");
  const offset = Math.max(0, Math.round(Number(url.searchParams.get("offset")) || 0));
  // Strip characters that carry meaning inside a PostgREST `.or()` filter so a
  // stray comma/paren/percent can't break (or inject into) the query.
  const search = (url.searchParams.get("q") ?? "").replace(/[,()%*]/g, "").trim();

  const supabase = await createClient();
  let q = supabase
    .from("books")
    .select("code, title")
    .eq("school_id", schoolId)
    .eq("status", "active")
    .order("code", { ascending: true });
  if (idsParam) {
    q = q.in("id", idsParam.split(",").filter(Boolean)).limit(BATCH_SIZE);
  } else {
    if (search) q = q.or(`title.ilike.%${search}%,code.ilike.%${search}%`);
    // Slice [offset, offset + BATCH_SIZE) — one printable batch.
    q = q.range(offset, offset + BATCH_SIZE - 1);
  }
  const { data: books } = await q;

  if (!books || books.length === 0) {
    return NextResponse.json({ error: "No books to print labels for." }, { status: 404 });
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
