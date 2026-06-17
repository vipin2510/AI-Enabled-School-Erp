"use server";

import { revalidatePath } from "next/cache";
import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { currentAcademicYear } from "@/lib/academic-year";

// Admin/manager only — adds a new class to the currently active school.
// `code` is unique per school (see migration 0017). `ordinal` controls
// sort order across the academics screens; the form defaults it to
// max(existing) + 1 so adds land at the end.
//
// Side effect: seeds an empty school-scope fee_structure for the current
// academic year so the class shows up in /fees/structures immediately with
// editable 0 amounts — otherwise admins had no way to add a row there.
export async function addClass(formData: FormData) {
  const profile = await requireDepartment("academics");
  if (profile.role === "staff") return;
  const schoolId = await getCurrentSchoolId(profile);
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const display_name = String(formData.get("display_name") ?? "").trim();
  const ordinalRaw = String(formData.get("ordinal") ?? "").trim();
  const ordinal = ordinalRaw === "" ? null : Number.parseInt(ordinalRaw, 10);
  if (!code || !display_name || ordinal == null || !Number.isFinite(ordinal)) return;

  const supabase = await createClient();
  const { data: cls, error } = await supabase
    .from("classes")
    .insert({ code, display_name, ordinal, school_id: schoolId })
    .select("id")
    .single();
  if (error || !cls) {
    revalidatePath("/academics/classes");
    return;
  }

  await seedSchoolFeeStructure(cls.id, schoolId);

  revalidatePath("/academics/classes");
  revalidatePath("/academics/subjects");
  revalidatePath("/fees/structures");
  revalidatePath("/academics/timetable");
}

// Creates the school-scope fee_structure + skeleton components (all 0)
// for a class in the current academic year. Mirrors the seed pattern from
// migration 0002 so the Fee Structures editor finds the same component
// kinds (registration / admission_one_time / caution / yearly + 12 monthly).
async function seedSchoolFeeStructure(classId: string, schoolId: string) {
  const supabase = await createClient();
  const ay = currentAcademicYear();

  const { data: fs } = await supabase
    .from("fee_structures")
    .insert({
      academic_year: ay,
      scope: "school",
      class_id: classId,
      student_kind: "any",
      total_amount: 0,
      school_id: schoolId,
    })
    .select("id")
    .single();
  if (!fs) return;

  const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  // Apr-start session: month 1 of the structure = April.
  const monthly = Array.from({ length: 12 }, (_, i) => {
    const monthIdx = ((3 + i) % 12) + 1;
    return {
      structure_id: fs.id,
      kind: "monthly" as const,
      label: `Monthly Fee — ${MONTHS[monthIdx - 1]}`,
      period_index: monthIdx,
      amount: 0,
      is_refundable: false,
      is_one_time: false,
      sort_order: 100 + i,
      school_id: schoolId,
    };
  });

  await supabase.from("fee_structure_components").insert([
    {
      structure_id: fs.id, kind: "registration", label: "Registration Fee",
      period_index: null, amount: 0, is_refundable: false, is_one_time: true,
      sort_order: 0, school_id: schoolId,
    },
    {
      structure_id: fs.id, kind: "admission_one_time", label: "New Admission Fee",
      period_index: null, amount: 0, is_refundable: false, is_one_time: true,
      sort_order: 1, school_id: schoolId,
    },
    {
      structure_id: fs.id, kind: "caution", label: "Caution Money",
      period_index: null, amount: 0, is_refundable: true, is_one_time: true,
      sort_order: 2, school_id: schoolId,
    },
    {
      structure_id: fs.id, kind: "yearly", label: "Yearly Fee (Books/Dev)",
      period_index: null, amount: 0, is_refundable: false, is_one_time: true,
      sort_order: 3, school_id: schoolId,
    },
    ...monthly,
  ]);
}

export async function addSection(formData: FormData) {
  const profile = await requireDepartment("academics");
  const schoolId = await getCurrentSchoolId(profile);
  const class_id = String(formData.get("class_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!class_id || !name) return;

  const supabase = await createClient();
  await supabase.from("sections").insert({ class_id, name, school_id: schoolId });
  revalidatePath("/academics/classes");
}

export async function removeSection(formData: FormData) {
  const profile = await requireDepartment("academics");
  const schoolId = await getCurrentSchoolId(profile);
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("sections").delete().eq("school_id", schoolId).eq("id", id);
  revalidatePath("/academics/classes");
}

export async function addSubject(formData: FormData) {
  const profile = await requireDepartment("academics");
  const schoolId = await getCurrentSchoolId(profile);
  const class_id = String(formData.get("class_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const categoryRaw = String(formData.get("category") ?? "scholastic");
  const category = categoryRaw === "co_curricular" ? "co_curricular" : "scholastic";
  if (!class_id || !name) return;

  const supabase = await createClient();
  await supabase.from("subjects").insert({ class_id, name, category, school_id: schoolId });
  revalidatePath("/academics/subjects");
}

export async function removeSubject(formData: FormData) {
  const profile = await requireDepartment("academics");
  const schoolId = await getCurrentSchoolId(profile);
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("subjects").delete().eq("school_id", schoolId).eq("id", id);
  revalidatePath("/academics/subjects");
}
