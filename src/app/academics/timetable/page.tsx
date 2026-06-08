import { requireDepartment } from "@/lib/auth";
import TimetableBuilder from "./timetable-builder";

export const dynamic = "force-dynamic";

export default async function TimetablePage() {
  await requireDepartment("academics");

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Timetable Generator</h1>
        <p className="mt-1 text-sm text-stone-500">
          Enter the class&apos;s requirements and we&apos;ll generate three timetable
          variations. Pick the one you like and download it as a PDF. Nothing here is
          saved — refresh and you start over.
        </p>
      </header>
      <TimetableBuilder />
    </div>
  );
}
