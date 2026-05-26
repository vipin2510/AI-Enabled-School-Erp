import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "student-photos";

// Upload a student/parent photo to the public bucket and return its public URL.
// Uploads use the service-role client so they bypass RLS. Returns null for an
// empty/absent file.
export async function uploadStudentPhoto(
  studentId: string,
  kind: "student" | "parent",
  file: File | null
): Promise<string | null> {
  if (!file || file.size === 0) return null;

  const admin = createAdminClient();
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  // Time-stamped name busts the CDN cache when a photo is replaced.
  const path = `${studentId}/${kind}-${Date.now()}.${ext || "jpg"}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error } = await admin.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type || "image/jpeg",
    upsert: true,
  });
  if (error) throw new Error(error.message);

  return admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
