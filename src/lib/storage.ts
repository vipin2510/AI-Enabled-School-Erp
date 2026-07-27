import { AwsClient } from "aws4fetch";
import { createAdminClient } from "@/lib/supabase/admin";

// File storage lives in Cloudflare R2 (S3-compatible, 10 GB free tier, zero
// egress fees). When the R2_* env vars are set we upload there; otherwise we
// fall back to the legacy Supabase Storage bucket so nothing breaks before the
// env is configured. See docs/storage-migration.md for setup + the one-time
// data migration of existing files.
//
// Object keys are prefixed with a logical "bucket" folder (student-photos/…,
// signatures/…). In R2 that's just a key prefix inside a single bucket; for the
// Supabase fallback the first path segment IS the bucket name, so the same key
// maps cleanly to both backends.
const PHOTO_PREFIX = "student-photos";
const SIGNATURE_PREFIX = "signatures";

const R2 = {
  accountId: process.env.R2_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  bucket: process.env.R2_BUCKET,
  // Public base URL of the bucket (r2.dev subdomain or a custom domain), no
  // trailing slash. Files are served from `${publicBase}/${key}`.
  publicBase: (process.env.R2_PUBLIC_BASE_URL || "").replace(/\/+$/, ""),
};

function r2Enabled(): boolean {
  return !!(
    R2.accountId &&
    R2.accessKeyId &&
    R2.secretAccessKey &&
    R2.bucket &&
    R2.publicBase
  );
}

let _client: AwsClient | null = null;
function r2Client(): AwsClient {
  if (!_client) {
    _client = new AwsClient({
      accessKeyId: R2.accessKeyId!,
      secretAccessKey: R2.secretAccessKey!,
      service: "s3",
      region: "auto",
    });
  }
  return _client;
}

// Store `bytes` under `key` and return a public URL. Uses R2 when configured,
// else the legacy Supabase Storage bucket (first path segment = bucket name).
async function putObject(
  key: string,
  bytes: Uint8Array,
  contentType: string
): Promise<string> {
  if (r2Enabled()) {
    const endpoint = `https://${R2.accountId}.r2.cloudflarestorage.com/${R2.bucket}/${key}`;
    const res = await r2Client().fetch(endpoint, {
      method: "PUT",
      // Uint8Array is a valid fetch body at runtime; the DOM lib's generic
      // BufferSource typing doesn't line up, so cast.
      body: bytes as unknown as BodyInit,
      headers: { "Content-Type": contentType },
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`R2 upload failed (${res.status}) ${detail}`.trim());
    }
    return `${R2.publicBase}/${key}`;
  }

  // Legacy Supabase Storage: the first path segment is the bucket, the rest is
  // the object path. Service-role client bypasses RLS. upsert overwrites.
  const slash = key.indexOf("/");
  const bucket = key.slice(0, slash);
  const path = key.slice(slash + 1);
  const admin = createAdminClient();
  const { error } = await admin.storage.from(bucket).upload(path, bytes, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(error.message);
  return admin.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

// Upload a student/parent photo and return its public URL. Returns null for an
// empty/absent file.
export async function uploadStudentPhoto(
  studentId: string,
  kind: "student" | "parent",
  file: File | null
): Promise<string | null> {
  if (!file || file.size === 0) return null;

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  // Time-stamped name busts the CDN cache when a photo is replaced.
  const key = `${PHOTO_PREFIX}/${studentId}/${kind}-${Date.now()}.${ext || "jpg"}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  return putObject(key, bytes, file.type || "image/jpeg");
}

// Upload a signature image (class-teacher or principal) and return its public
// URL. Returns null for an empty/absent file so callers can leave it blank.
export async function uploadSignature(
  scope: string, // e.g. `${schoolId}/ct-${classId}-${section}` or `${schoolId}/principal`
  file: File | null
): Promise<string | null> {
  if (!file || file.size === 0) return null;

  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  // Time-stamped name busts the CDN cache when a signature is replaced.
  const key = `${SIGNATURE_PREFIX}/${scope}-${Date.now()}.${ext || "png"}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  return putObject(key, bytes, file.type || "image/png");
}
