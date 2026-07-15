"use server";

import { revalidatePath } from "next/cache";
import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { uploadSignature } from "@/lib/storage";

function fileFrom(formData: FormData, key: string): File | null {
  const f = formData.get(key);
  return f instanceof File && f.size > 0 ? f : null;
}

// Assign (or clear) a class+section's class teacher and, optionally, upload
// their signature. Everything is optional — a blank teacher or no file is a
// valid state and must NOT error.
export async function saveClassTeacher(formData: FormData) {
  const profile = await requireDepartment("academics");
  const schoolId = await getCurrentSchoolId(profile);

  const class_id = String(formData.get("class_id") ?? "").trim();
  if (!class_id) return; // nothing to save
  const section = String(formData.get("section") ?? "").trim(); // '' = no section
  const teacherRaw = String(formData.get("teacher_id") ?? "").trim();
  const teacher_id = teacherRaw === "" ? null : teacherRaw;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("class_teachers")
    .select("signature_url")
    .eq("school_id", schoolId)
    .eq("class_id", class_id)
    .eq("section", section)
    .maybeSingle();

  let signature_url = existing?.signature_url ?? null;
  const sig = fileFrom(formData, "signature");
  if (sig) {
    signature_url = await uploadSignature(`${schoolId}/ct-${class_id}-${section || "none"}`, sig);
  }

  await supabase.from("class_teachers").upsert(
    {
      school_id: schoolId,
      class_id,
      section,
      teacher_id,
      signature_url,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "school_id,class_id,section" }
  );

  revalidatePath("/academics/signatures");
}

// Set the school principal (optional) and upload their signature (optional).
export async function savePrincipalSignature(formData: FormData) {
  const profile = await requireDepartment("academics");
  const schoolId = await getCurrentSchoolId(profile);

  const principalRaw = String(formData.get("principal_id") ?? "").trim();
  const principal_id = principalRaw === "" ? null : principalRaw;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("school_pdf_settings")
    .select("principal_signature_url")
    .eq("school_id", schoolId)
    .maybeSingle();

  let principal_signature_url = existing?.principal_signature_url ?? null;
  const sig = fileFrom(formData, "signature");
  if (sig) {
    principal_signature_url = await uploadSignature(`${schoolId}/principal`, sig);
  }

  await supabase.from("school_pdf_settings").upsert(
    {
      school_id: schoolId,
      principal_id,
      principal_signature_url,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "school_id" }
  );

  revalidatePath("/academics/signatures");
}
