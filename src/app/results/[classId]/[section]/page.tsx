import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import { currentAcademicYear, computeResult, EXAMS, gradeFor } from "@/lib/results";
import { loadClassSection, loadMarksByStudent } from "../../shared";
import ResultsToolbar from "./toolbar";

export const dynamic = "force-dynamic";

const TOTAL_CELLS = EXAMS.length;

export default async function ClassSectionResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string; section: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const profile = await requireDepartment("results");
  const schoolId = await getCurrentSchoolId(profile);
  const { classId, section: rawSection } = await params;
  const section = decodeURIComponent(rawSection);
  const { saved } = await searchParams;

  const { klass, subjects, students } = await loadClassSection(classId, section, schoolId);
  if (!klass) notFound();

  const academicYear = currentAcademicYear();
  const marksByStudent = await loadMarksByStudent(students.map((s) => s.id), academicYear, schoolId);
  const cellsPerStudent = subjects.length * TOTAL_CELLS;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <Link href="/results" className="text-sm text-stone-500 hover:underline">
          ← All classes
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {klass.display_name} · Section {section}
            </h1>
            <p className="mt-1 text-sm text-stone-500">
              {students.length} student{students.length === 1 ? "" : "s"} ·{" "}
              {subjects.length} subject{subjects.length === 1 ? "" : "s"}
            </p>
          </div>
          <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-medium text-stone-600">
            Academic Year {academicYear}
          </span>
        </div>
      </header>

      {saved && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">
          Marks saved.
        </div>
      )}

      {subjects.length === 0 ? (
        <div className="card mb-6 p-5 text-sm text-stone-600">
          No subjects are defined for {klass.display_name}.{" "}
          <Link href="/academics/subjects" className="text-accent hover:underline">
            Add subjects
          </Link>{" "}
          to start entering marks.
        </div>
      ) : (
        <ResultsToolbar
          classId={classId}
          section={section}
          subjects={subjects}
          hasStudents={students.length > 0}
        />
      )}

      <div className="card mt-6 overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">Student</th>
              <th className="px-4 py-3 font-medium">Father</th>
              <th className="px-4 py-3 font-medium">Entered</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
              <th className="px-4 py-3 text-right font-medium">%</th>
              <th className="px-4 py-3 text-center font-medium">Grade</th>
              <th className="px-4 py-3 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s, i) => {
              const marks = marksByStudent[s.id] ?? {};
              const entered = Object.values(marks).filter((v) => v !== null && v !== undefined).length;
              const result = computeResult(subjects, marks);
              const hasAny = entered > 0;
              return (
                <tr key={s.id} className="border-t border-stone-100 hover:bg-stone-50/60">
                  <td className="px-4 py-3 text-stone-400">{i + 1}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/results/${classId}/${encodeURIComponent(section)}/student/${s.id}`}
                      className="font-medium text-stone-900 hover:text-accent hover:underline"
                    >
                      {s.full_name}
                    </Link>
                    {s.admission_no && (
                      <span className="ml-2 text-xs text-stone-400">{s.admission_no}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-stone-600">{s.father_name ?? "—"}</td>
                  <td className="px-4 py-3 text-stone-600">
                    {entered}/{cellsPerStudent}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {hasAny ? `${result.total}/${result.max}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {hasAny ? `${result.percent.toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {hasAny ? (
                      <span className="inline-flex min-w-[2rem] justify-center rounded-md bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-700">
                        {gradeFor(result.percent)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/results/${classId}/${encodeURIComponent(section)}/student/${s.id}`}
                      className="text-accent hover:underline"
                    >
                      Enter marks
                    </Link>
                  </td>
                </tr>
              );
            })}
            {students.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-stone-500">
                  No students enrolled in this section.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
