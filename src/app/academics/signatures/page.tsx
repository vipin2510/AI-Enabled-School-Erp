import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { saveClassTeacher, savePrincipalSignature } from "./actions";

export const dynamic = "force-dynamic";

type ClassRow = { id: string; display_name: string; ordinal: number };
type SectionRow = { id: string; class_id: string; name: string };
type Teacher = { id: string; full_name: string | null; role: string };
type CT = {
  class_id: string;
  section: string;
  teacher_id: string | null;
  signature_url: string | null;
};

const field =
  "rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm";

export default async function SignaturesPage() {
  const profile = await requireDepartment("academics");
  const schoolId = await getCurrentSchoolId(profile);
  const supabase = await createClient();

  const [{ data: classes }, { data: sections }, { data: teachers }, { data: cts }, { data: settings }] =
    await Promise.all([
      supabase
        .from("classes")
        .select("id, display_name, ordinal")
        .eq("school_id", schoolId)
        .order("ordinal"),
      supabase
        .from("sections")
        .select("id, class_id, name")
        .eq("school_id", schoolId)
        .order("name"),
      supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("group_id", profile.group_id)
        .eq("is_active", true)
        .contains("school_ids", [schoolId])
        .order("full_name"),
      supabase
        .from("class_teachers")
        .select("class_id, section, teacher_id, signature_url")
        .eq("school_id", schoolId),
      supabase
        .from("school_pdf_settings")
        .select("principal_id, principal_signature_url")
        .eq("school_id", schoolId)
        .maybeSingle(),
    ]);

  const teacherList = (teachers ?? []) as Teacher[];
  const sectionsByClass = new Map<string, string[]>();
  for (const s of (sections ?? []) as SectionRow[]) {
    if (!sectionsByClass.has(s.class_id)) sectionsByClass.set(s.class_id, []);
    sectionsByClass.get(s.class_id)!.push(s.name);
  }
  const ctByKey = new Map<string, CT>();
  for (const ct of (cts ?? []) as CT[]) ctByKey.set(`${ct.class_id}|${ct.section}`, ct);

  const TeacherSelect = ({ selected }: { selected: string | null }) => (
    <select name="teacher_id" defaultValue={selected ?? ""} className={field} aria-label="Class teacher">
      <option value="">— none —</option>
      {teacherList.map((t) => (
        <option key={t.id} value={t.id}>
          {t.full_name || "(unnamed)"} · {t.role}
        </option>
      ))}
    </select>
  );

  return (
    <div className="max-w-4xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Digital Signatures</h1>
        <p className="text-stone-500 text-sm">
          Upload the principal&apos;s signature and assign a class teacher (with their signature) to
          each class &amp; section. Everything is optional — leave any of it blank and nothing breaks.
          The class teacher set here is used for the first period of the timetable.
        </p>
      </header>

      {/* Principal signature (school-level) */}
      <div className="card p-4 mb-6">
        <div className="mb-3 font-medium">Principal</div>
        <form
          action={savePrincipalSignature}
          encType="multipart/form-data"
          className="flex flex-wrap items-center gap-3"
        >
          <select
            name="principal_id"
            defaultValue={settings?.principal_id ?? ""}
            className={field}
            aria-label="Principal"
          >
            <option value="">— none —</option>
            {teacherList.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name || "(unnamed)"} · {t.role}
              </option>
            ))}
          </select>
          <input type="file" name="signature" accept="image/*" className="text-sm" />
          <button className="rounded-lg bg-stone-900 px-3 py-1.5 text-sm text-stone-50">Save</button>
          {settings?.principal_signature_url && (
            <span className="ml-auto flex items-center gap-2 text-xs text-stone-400">
              current
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={settings.principal_signature_url}
                alt="Principal signature"
                className="h-10 w-auto rounded border border-stone-200 bg-white"
              />
            </span>
          )}
        </form>
      </div>

      {(classes ?? []).length === 0 && (
        <div className="card p-4 text-sm text-stone-500">
          No classes yet for this school. Add classes from{" "}
          <a href="/academics/classes" className="text-accent hover:underline">
            Classes &amp; Sections
          </a>{" "}
          first.
        </div>
      )}

      <div className="space-y-3">
        {(classes as ClassRow[] | null ?? []).map((c) => {
          const secs = sectionsByClass.get(c.id) ?? [];
          const combos = secs.length ? secs : [""];
          return (
            <div key={c.id} className="card p-4">
              <div className="mb-2 font-medium">{c.display_name}</div>
              <div className="space-y-2">
                {combos.map((section) => {
                  const ct = ctByKey.get(`${c.id}|${section}`);
                  return (
                    <form
                      key={section || "none"}
                      action={saveClassTeacher}
                      encType="multipart/form-data"
                      className="flex flex-wrap items-center gap-2"
                    >
                      <input type="hidden" name="class_id" value={c.id} />
                      <input type="hidden" name="section" value={section} />
                      <span className="w-16 text-sm text-stone-500">
                        {section ? `Sec ${section}` : "—"}
                      </span>
                      <TeacherSelect selected={ct?.teacher_id ?? null} />
                      <input type="file" name="signature" accept="image/*" className="text-sm" />
                      <button className="rounded-lg bg-stone-900 px-3 py-1.5 text-sm text-stone-50">
                        Save
                      </button>
                      {ct?.signature_url && (
                        <span className="ml-auto flex items-center gap-2 text-xs text-stone-400">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={ct.signature_url}
                            alt="Class teacher signature"
                            className="h-9 w-auto rounded border border-stone-200 bg-white"
                          />
                        </span>
                      )}
                    </form>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
