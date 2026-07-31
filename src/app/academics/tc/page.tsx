import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole, getCurrentSchoolId } from "@/lib/auth";
import { inr, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

type TcRow = {
  id: string;
  tc_no: string | null;
  student_name: string | null;
  status: string;
  issued_on: string | null;
  no_dues_amount: number | null;
  student_id: string;
};

export default async function TcListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; issued?: string }>;
}) {
  const profile = await requireRole("admin", "manager");
  const schoolId = await getCurrentSchoolId(profile);
  const { q, issued } = await searchParams;
  const supabase = await createClient();

  let studentQ = supabase
    .from("students")
    .select("id, full_name, section, father_name, status, classes(display_name)")
    .eq("school_id", schoolId)
    .order("full_name")
    .limit(25);
  if (q) {
    const term = q.replace(/[%,]/g, " ").trim();
    studentQ = studentQ.or(`full_name.ilike.%${term}%,contact_number.ilike.%${term}%,father_name.ilike.%${term}%`);
  }

  const [studentsRes, tcRes] = await Promise.all([
    q ? studentQ : Promise.resolve({ data: [], error: null }),
    supabase
      .from("transfer_certificates")
      .select("id, tc_no, student_name, status, issued_on, no_dues_amount, student_id")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  const students = (studentsRes.data ?? []) as unknown as {
    id: string; full_name: string; section: string | null; father_name: string | null; status: string; classes: { display_name?: string } | null;
  }[];
  const tcs = (tcRes.data ?? []) as unknown as TcRow[];

  return (
    <div className="max-w-4xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Transfer Certificates</h1>
        <p className="text-stone-500 text-sm">Issue a TC (admin), check no-dues, and download the certificate. Issuing freezes the student.</p>
      </header>

      {issued && (
        <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          TC issued and student frozen. <Link className="underline" href={`/api/transfer-certificate/${issued}/pdf`}>Download TC PDF →</Link>
        </div>
      )}

      <section className="card mb-6 p-5">
        <h2 className="mb-3 text-sm font-semibold text-stone-700">Start a new TC</h2>
        <form method="GET" className="flex flex-col gap-3 sm:flex-row">
          <input name="q" defaultValue={q ?? ""} placeholder="Search student by name, mobile, father…" className="flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm" />
          <button className="rounded-lg bg-stone-900 px-4 py-2 text-sm text-stone-50">Search</button>
        </form>
        {q && (
          <div className="mt-3 divide-y divide-stone-100 rounded-lg border border-stone-200">
            {students.length === 0 && <div className="px-4 py-6 text-center text-sm text-stone-500">No students match.</div>}
            {students.map((s) => (
              <Link key={s.id} href={`/academics/tc/${s.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-stone-50">
                <div>
                  <div className="font-medium">{s.full_name}</div>
                  <div className="text-xs text-stone-500">
                    {s.classes?.display_name ?? "—"}{s.section ? ` · ${s.section}` : ""}{s.father_name ? ` · S/o ${s.father_name}` : ""}
                  </div>
                </div>
                {s.status !== "active" ? <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">frozen</span> : <span className="text-stone-400">→</span>}
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-stone-800">Issued & pending</h2>
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-stone-500">
              <tr><th className="px-4 py-2 font-medium">TC No.</th><th className="px-4 py-2 font-medium">Student</th><th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2 font-medium">Issued</th><th className="px-4 py-2 font-medium text-right">Dues</th><th className="px-4 py-2 font-medium text-right">PDF</th></tr>
            </thead>
            <tbody>
              {tcs.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-stone-500">No transfer certificates yet.</td></tr>}
              {tcs.map((t) => (
                <tr key={t.id} className="border-t border-stone-100">
                  <td className="px-4 py-2 font-mono text-xs">{t.tc_no ?? "—"}</td>
                  <td className="px-4 py-2">{t.student_name}</td>
                  <td className="px-4 py-2 capitalize">{t.status}</td>
                  <td className="px-4 py-2 text-stone-500">{t.issued_on ? formatDate(t.issued_on) : "—"}</td>
                  <td className="px-4 py-2 text-right">{Number(t.no_dues_amount) > 0 ? inr(t.no_dues_amount) : "Nil"}</td>
                  <td className="px-4 py-2 text-right">
                    {t.status === "issued" ? <Link href={`/api/transfer-certificate/${t.id}/pdf`} className="text-stone-700 underline">PDF</Link> : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
