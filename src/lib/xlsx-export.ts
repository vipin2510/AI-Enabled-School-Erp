import * as XLSX from "xlsx";

// Build a .xlsx file buffer from an array of flat row objects. Column order
// follows `headers` if given, else the keys of the first row. Returns a Node
// Buffer ready to stream from a route handler. Mirrors the read-side use of the
// `xlsx` package elsewhere (library/results imports) — this is the write side.
export function rowsToXlsxBuffer(
  rows: Record<string, string | number | null | undefined>[],
  opts?: { sheetName?: string; headers?: string[] },
): Buffer {
  const ws = XLSX.utils.json_to_sheet(rows, opts?.headers ? { header: opts.headers } : undefined);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, opts?.sheetName ?? "Sheet1");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

// Wrap an .xlsx buffer in a downloadable Response with the right MIME type.
export function xlsxResponse(buffer: Buffer, filename: string): Response {
  return new Response(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
