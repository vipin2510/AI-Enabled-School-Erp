import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadClassesAndSections } from "../../../shared";
import { updateStudent, type StudentState } from "../../actions";
import StudentForm from "../../student-form";

export const dynamic = "force-dynamic";

export default async function EditStudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin", "manager");
  const { id } = await params;
  const supabase = await createClient();

  const { data: student } = await supabase
    .from("students")
    .select(
      "id, full_name, admission_no, class_id, section, gender, father_name, mother_name, contact_number, address, is_hosteller, is_new_admission, status"
    )
    .eq("id", id)
    .single();

  if (!student) notFound();

  const { classes, sectionsByClass } = await loadClassesAndSections();

  // Bind the student id into the update action so the form signature stays
  // (prevState, formData).
  const action = (prev: StudentState, formData: FormData) =>
    updateStudent(id, prev, formData);

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <Link href="/academics/students" className="text-sm text-stone-600 hover:underline">
          ← Students
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Edit Student</h1>
      </header>
      <div className="card p-6">
        <StudentForm
          action={action}
          classes={classes}
          sectionsByClass={sectionsByClass}
          submitLabel="Save changes"
          initial={{
            full_name: student.full_name ?? "",
            admission_no: student.admission_no ?? "",
            class_id: student.class_id ?? "",
            section: student.section ?? "",
            gender: student.gender ?? "",
            father_name: student.father_name ?? "",
            mother_name: student.mother_name ?? "",
            contact_number: student.contact_number ?? "",
            address: student.address ?? "",
            is_hosteller: student.is_hosteller ?? false,
            is_new_admission: student.is_new_admission ?? false,
            status: student.status ?? "active",
          }}
        />
      </div>
    </div>
  );
}
