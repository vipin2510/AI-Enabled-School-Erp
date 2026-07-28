/**
 * One-time migration of existing files from Supabase Storage → Cloudflare R2.
 *
 * It walks the DB columns that hold storage URLs (student photos, parent
 * photos, class-teacher signatures, principal signatures), downloads each file
 * from its current Supabase public URL, uploads it to R2 under the SAME key,
 * then rewrites the DB column to the R2 public URL.
 *
 * Safe to re-run: URLs already pointing at R2 are skipped, and each object is
 * re-uploaded (overwrite) so a partial run can be resumed.
 *
 *   npx tsx scripts/migrate-storage-to-r2.ts            # do it
 *   DRY_RUN=1 npx tsx scripts/migrate-storage-to-r2.ts  # report only, no writes
 *
 * Requires in .env.local (or .env):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE_URL
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { AwsClient } from "aws4fetch";

config({ path: ".env.local" });
config();

const DRY_RUN = !!process.env.DRY_RUN;

const SUPABASE_URL = need("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = need("SUPABASE_SERVICE_ROLE_KEY");
const R2_ACCOUNT_ID = need("R2_ACCOUNT_ID");
const R2_ACCESS_KEY_ID = need("R2_ACCESS_KEY_ID");
const R2_SECRET_ACCESS_KEY = need("R2_SECRET_ACCESS_KEY");
const R2_BUCKET = need("R2_BUCKET");
const R2_PUBLIC_BASE = need("R2_PUBLIC_BASE_URL").replace(/\/+$/, "");

// Any Supabase public-storage URL contains this marker; the object key is
// everything after it. Matching on the marker (rather than the current
// project's exact host) also migrates files still hosted on an older Supabase
// project that earlier photos were uploaded to.
const PUBLIC_MARKER = "/storage/v1/object/public/";

function need(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env var ${name}`);
    process.exit(1);
  }
  return v;
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  db: { schema: "erp" },
  auth: { autoRefreshToken: false, persistSession: false },
});

const r2 = new AwsClient({
  accessKeyId: R2_ACCESS_KEY_ID,
  secretAccessKey: R2_SECRET_ACCESS_KEY,
  service: "s3",
  region: "auto",
});

// Cache so a file referenced by several rows is copied once.
const migrated = new Map<string, string>(); // oldUrl -> newUrl

function contentTypeFor(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

// Copy one Supabase-hosted file to R2 (same key) and return its new public URL.
// Returns the URL unchanged if it isn't a Supabase public URL (already R2, or
// an external URL we don't own).
async function migrateUrl(oldUrl: string | null): Promise<string | null> {
  if (!oldUrl) return null;
  if (oldUrl.startsWith(`${R2_PUBLIC_BASE}/`)) return oldUrl; // already on R2
  const idx = oldUrl.indexOf(PUBLIC_MARKER);
  if (idx === -1) return oldUrl; // not a Supabase public URL we can migrate
  const cached = migrated.get(oldUrl);
  if (cached) return cached;

  const key = oldUrl.slice(idx + PUBLIC_MARKER.length); // e.g. student-photos/<id>/student-….jpg
  const newUrl = `${R2_PUBLIC_BASE}/${key}`;

  if (DRY_RUN) {
    console.log(`  would copy ${key}`);
    migrated.set(oldUrl, newUrl);
    return newUrl;
  }

  const src = await fetch(oldUrl);
  if (!src.ok) {
    console.warn(`  SKIP (download ${src.status}): ${oldUrl}`);
    return oldUrl; // leave the DB pointing at the original
  }
  const bytes = new Uint8Array(await src.arrayBuffer());
  const put = await r2.fetch(
    `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}`,
    {
      method: "PUT",
      body: bytes,
      // R2 rejects a PUT without Content-Length (HTTP 411) when fetch would
      // otherwise stream the body chunked.
      headers: { "Content-Type": contentTypeFor(key), "Content-Length": String(bytes.byteLength) },
    }
  );
  if (!put.ok) {
    console.warn(`  SKIP (R2 ${put.status}): ${key} — ${await put.text().catch(() => "")}`);
    return oldUrl;
  }
  console.log(`  copied ${key} (${bytes.length} bytes)`);
  migrated.set(oldUrl, newUrl);
  return newUrl;
}

async function migrateTable<T extends Record<string, unknown>>(
  table: string,
  idCol: string,
  urlCols: string[]
) {
  console.log(`\n== ${table} (${urlCols.join(", ")}) ==`);
  // PostgREST caps a select at 1000 rows, so page through the whole table —
  // otherwise rows past the first 1000 silently never get migrated.
  const PAGE = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select([idCol, ...urlCols].join(", "))
      .range(from, from + PAGE - 1);
    if (error) {
      console.error(`  query failed: ${error.message}`);
      return;
    }
    const batch = (data ?? []) as unknown as T[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  let updated = 0;
  for (const row of rows) {
    const patch: Record<string, string> = {};
    for (const col of urlCols) {
      const oldUrl = (row[col] as string | null) ?? null;
      const newUrl = await migrateUrl(oldUrl);
      if (newUrl && newUrl !== oldUrl) patch[col] = newUrl;
    }
    if (Object.keys(patch).length === 0) continue;
    updated++;
    if (DRY_RUN) {
      console.log(`  would update ${table}.${row[idCol]} →`, patch);
      continue;
    }
    const { error: upErr } = await supabase.from(table).update(patch).eq(idCol, row[idCol] as string);
    if (upErr) console.warn(`  update failed for ${row[idCol]}: ${upErr.message}`);
  }
  console.log(`  ${updated} row(s) ${DRY_RUN ? "would be" : ""} updated`);
}

async function main() {
  console.log(DRY_RUN ? "DRY RUN — no files copied, no DB writes\n" : "Migrating Supabase Storage → R2\n");
  await migrateTable("students", "id", ["student_photo_url", "parent_photo_url"]);
  await migrateTable("class_teachers", "id", ["signature_url"]);
  await migrateTable("school_pdf_settings", "school_id", ["principal_signature_url"]);
  console.log(`\nDone. ${migrated.size} distinct file(s) handled.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
