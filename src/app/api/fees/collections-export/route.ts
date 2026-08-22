import { createClient } from "@/lib/supabase/server";
import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import { getCollectionsSummary, MODE_LABEL } from "@/lib/collections";

export const dynamic = "force-dynamic";

const isDate = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

function csvCell(value: string | number | null | undefined) {
  const s = value == null ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

// GET /api/fees/collections-export?from=YYYY-MM-DD&to=YYYY-MM-DD
// CSV of daily fee collections split by payment mode, with a totals row.
export async function GET(req: Request) {
  const profile = await requireDepartment("fees");
  const schoolId = await getCurrentSchoolId(profile);
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!isDate(from) || !isDate(to)) {
    return new Response("Provide from and to as YYYY-MM-DD.", { status: 400 });
  }

  const supabase = await createClient();
  let summary;
  try {
    summary = await getCollectionsSummary(supabase, schoolId, from, to);
  } catch (e) {
    return new Response(`Export failed: ${(e as Error).message}`, { status: 500 });
  }
  const { modes, byMode, byDay, total, count } = summary;

  const header = ["Date", ...modes.map((m) => MODE_LABEL[m] ?? m), "Total", "Receipts"];
  const lines = [header.map(csvCell).join(",")];
  for (const d of byDay) {
    lines.push(
      [
        d.date,
        ...modes.map((m) => Math.round(d.modeAmounts[m] ?? 0)),
        Math.round(d.total),
        d.count,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  // Totals row.
  lines.push(
    ["Total", ...modes.map((m) => Math.round(byMode[m].amount)), Math.round(total), count]
      .map(csvCell)
      .join(","),
  );

  // UTF-8 BOM so Excel reads the ₹ / Hindi correctly.
  const csv = "﻿" + lines.join("\r\n") + "\r\n";
  const filename = `collections_${summary.from}_to_${summary.to}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
