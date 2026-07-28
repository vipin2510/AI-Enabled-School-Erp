/**
 * Delete files from the current Supabase Storage buckets AFTER the R2 migration.
 * Safe by design: for each object it verifies an R2 copy exists (and copies it
 * over first if somehow missing) BEFORE deleting from Supabase — so a file can
 * never be lost.
 *
 *   npx tsx scripts/purge-supabase-storage.ts             # DRY RUN: list + verify only
 *   CONFIRM=1 npx tsx scripts/purge-supabase-storage.ts   # actually delete from Supabase
 *
 * Only touches the project in NEXT_PUBLIC_SUPABASE_URL. Files on any older
 * Supabase project are not reachable with these credentials.
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { AwsClient } from "aws4fetch";

config({ path: ".env.local" });
config();

const DELETE = process.env.CONFIRM === "1";
const BUCKETS = ["student-photos", "signatures"];

const need = (n: string): string => {
  const v = process.env[n];
  if (!v) { console.error(`Missing env var ${n}`); process.exit(1); }
  return v;
};

const SUPABASE_URL = need("NEXT_PUBLIC_SUPABASE_URL");
const R2_ACCOUNT_ID = need("R2_ACCOUNT_ID");
const R2_BUCKET = need("R2_BUCKET");

const supabase = createClient(SUPABASE_URL, need("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { autoRefreshToken: false, persistSession: false },
});
const r2 = new AwsClient({
  accessKeyId: need("R2_ACCESS_KEY_ID"),
  secretAccessKey: need("R2_SECRET_ACCESS_KEY"),
  service: "s3",
  region: "auto",
});

const r2Url = (key: string) => `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}`;

async function r2Has(key: string): Promise<boolean> {
  const res = await r2.fetch(r2Url(key), { method: "HEAD" });
  return res.ok;
}

// Recursively list every file path in a bucket. Supabase returns folders as
// entries with id === null; files carry an id + metadata.
async function listAll(bucket: string): Promise<string[]> {
  const out: string[] = [];
  const LIMIT = 100;
  async function walk(prefix: string) {
    for (let offset = 0; ; offset += LIMIT) {
      const { data, error } = await supabase.storage
        .from(bucket)
        .list(prefix, { limit: LIMIT, offset, sortBy: { column: "name", order: "asc" } });
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const e of data) {
        const path = prefix ? `${prefix}/${e.name}` : e.name;
        if (e.id === null) await walk(path); // folder
        else out.push(path);
      }
      if (data.length < LIMIT) break;
    }
  }
  await walk("");
  return out;
}

async function ensureOnR2(bucket: string, path: string): Promise<boolean> {
  const key = `${bucket}/${path}`;
  if (await r2Has(key)) return true;
  // Missing on R2 — copy it over so we never delete an un-backed-up file.
  const pub = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  const src = await fetch(pub);
  if (!src.ok) { console.warn(`  cannot fetch ${path} (${src.status}); leaving in place`); return false; }
  const bytes = new Uint8Array(await src.arrayBuffer());
  const ct = src.headers.get("content-type") || "application/octet-stream";
  const put = await r2.fetch(r2Url(key), { method: "PUT", body: bytes as unknown as BodyInit, headers: { "Content-Type": ct, "Content-Length": String(bytes.byteLength) } });
  if (!put.ok) { console.warn(`  R2 copy failed for ${path} (${put.status}); leaving in place`); return false; }
  console.log(`  backfilled to R2: ${key}`);
  return true;
}

async function purgeBucket(bucket: string) {
  console.log(`\n== ${bucket} ==`);
  const files = await listAll(bucket);
  console.log(`  ${files.length} object(s) in Supabase`);
  const deletable: string[] = [];
  let backfilled = 0;
  for (const path of files) {
    const key = `${bucket}/${path}`;
    if (await r2Has(key)) { deletable.push(path); continue; }
    const ok = await ensureOnR2(bucket, path);
    if (ok) { deletable.push(path); backfilled++; }
  }
  console.log(`  ${deletable.length} verified on R2 (${backfilled} backfilled), ${files.length - deletable.length} skipped`);
  if (!DELETE) { console.log(`  DRY RUN — would delete ${deletable.length} object(s)`); return; }
  // Batch deletes (Supabase remove() accepts an array).
  for (let i = 0; i < deletable.length; i += 100) {
    const batch = deletable.slice(i, i + 100);
    const { error } = await supabase.storage.from(bucket).remove(batch);
    if (error) { console.warn(`  delete batch failed: ${error.message}`); continue; }
    console.log(`  deleted ${Math.min(i + 100, deletable.length)}/${deletable.length}`);
  }
}

async function main() {
  console.log(DELETE ? "DELETING from Supabase (verified on R2 first)\n" : "DRY RUN — no deletions\n");
  for (const b of BUCKETS) await purgeBucket(b);
  console.log("\nDone.");
}

main().catch((e) => { console.error(e); process.exit(1); });
