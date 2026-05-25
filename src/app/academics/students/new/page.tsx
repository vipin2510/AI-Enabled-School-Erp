import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { loadClassesAndSections } from "../../shared";
import { createStudent } from "../actions";
import StudentForm from "../student-form";

export const dynamic = "force-dynamic";

export default async function NewStudentPage() {
  await requireRole("admin", "manager");
  const { classes, sectionsByClass } = await loadClassesAndSections();

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <Link href="/academics/students" className="text-sm text-stone-600 hover:underline">
          ← Students
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Add Student</h1>
      </header>
      <div className="card p-6">
        <StudentForm
          action={createStudent}
          classes={classes}
          sectionsByClass={sectionsByClass}
          submitLabel="Create student"
        />
      </div>
    </div>
  );
}
