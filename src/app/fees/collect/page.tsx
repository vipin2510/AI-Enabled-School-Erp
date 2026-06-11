import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireDepartment, getCurrentSchoolId } from "@/lib/auth";
import { currentAcademicYear } from "@/lib/academic-year";
import { getClasses, getFeeStructures } from "@/lib/cache";
import BusFeeInline from "./bus-fee-inline";

export const dynamic = "force-dynamic";

type PayState = "paid" | "partial" | "due" | "unknown";

export default async function CollectFeePicker({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; class_id?: string }>;
}) {
  const profile = await requireDepartment("fees");
  const schoolId = await getCurrentSchoolId(profile);
  const { q, class_id } = await searchParams;
  const supabase = await createClient();
  const AY = currentAcademicYear();

  // Cached: classes change a couple of times a year; no point re-fetching on
  // every keystroke in the picker.
  const classes = await getClasses(schoolId);

  let query = supabase
    .from("students")
    .select("id, full_name, section, contact_number, father_name, class_id, bus_fee_amount, classes(display_name)")
    .eq("school_id", schoolId)
    .order("full_name")
    .limit(50);

  if (q) {
    const term = q.replace(/[%,]/g, " ").trim();
    query = query.or(
      `full_name.ilike.%${term}%,contact_number.ilike.%${term}%,father_name.ilike.%${term}%`
    );
  }
  if (class_id) query = query.eq("class_id", class_id);

  const { data, error: studentsErr } = await query;
  if (studentsErr) throw studentsErr;
  const students = data ?? [];

  // Fee status (current AY, school scope): how many of the class's fee
  // components has each student actually paid for?
  const statusByStudent = await computePaidStatus(supabase, students, schoolId, AY);

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Collect Fee</h1>
        <p className="text-stone-500 text-sm">
          Find a student by name, mobile number, father&apos;s name, or class.
        </p>
      </header>

      <form action="/fees/collect" className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Name, mobile, or father's name…"
          className="flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
        />
        <select
          name="class_id"
          defaultValue={class_id ?? ""}
          className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">All classes</option>
          {(classes ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.display_name}
            </option>
          ))}
        </select>
        <button className="rounded-lg bg-stone-900 px-4 py-2 text-sm text-stone-50">
          Search
        </button>
      </form>

      <div className="card divide-y divide-stone-100">
        {students.map((s) => {
          const row = s as unknown as {
            classes: { display_name?: string } | null;
            bus_fee_amount: number | null;
          };
          const klass = row.classes;
          return (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-stone-50"
            >
              <Link href={`/fees/collect/${s.id}`} className="min-w-0 flex-1">
                <div className="font-medium">{s.full_name}</div>
                <div className="text-xs text-stone-500">
                  {klass?.display_name ?? "—"}
                  {s.section ? ` · ${s.section}` : ""}
                  {s.father_name ? ` · S/o ${s.father_name}` : ""}
                  {s.contact_number ? ` · ${s.contact_number}` : ""}
                </div>
              </Link>
              <div className="flex shrink-0 items-center gap-3">
                <BusFeeInline studentId={s.id} initial={row.bus_fee_amount} />
                <PayBadge state={statusByStudent.get(s.id) ?? "unknown"} />
              </div>
            </div>
          );
        })}
        {!students.length && (
          <div className="px-4 py-8 text-center text-stone-500 text-sm">
            {q || class_id ? "No students match." : "Search or pick a class to begin."}
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-stone-400">
        Status reflects this year&apos;s ({AY}) school fee components paid.
      </p>
    </div>
  );
}

function PayBadge({ state }: { state: PayState }) {
  if (state === "unknown") return <span className="text-stone-400 text-sm">→</span>;
  const map: Record<Exclude<PayState, "unknown">, { label: string; cls: string }> = {
    paid: { label: "Paid", cls: "bg-green-50 text-green-700" },
    partial: { label: "Partial", cls: "bg-amber-50 text-amber-700" },
    due: { label: "Due", cls: "bg-red-50 text-red-700" },
  };
  const { label, cls } = map[state];
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>
  );
}

type StudentRow = { id: string; class_id: string | null };

async function computePaidStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  students: StudentRow[],
  schoolId: string,
  AY: string,
): Promise<Map<string, PayState>> {
  const result = new Map<string, PayState>();
  const ids = students.map((s) => s.id);
  const classIds = [...new Set(students.map((s) => s.class_id).filter(Boolean) as string[])];
  if (ids.length === 0) return result;

  // Required school components per class (current AY). Pulled from the cached
  // fee-structures bundle so we don't pay for a fresh query on every Collect
  // Fee picker render — the structures editor busts the tag on save.
  const requiredByClass = new Map<string, Set<string>>();
  if (classIds.length) {
    const classIdSet = new Set(classIds);
    const structures = (await getFeeStructures(schoolId, AY)) as {
      class_id: string | null;
      scope: string;
      fee_structure_components: { id: string }[] | null;
    }[];
    for (const st of structures) {
      if (st.scope !== "school") continue;
      if (!st.class_id || !classIdSet.has(st.class_id)) continue;
      const set = requiredByClass.get(st.class_id) ?? new Set<string>();
      for (const c of st.fee_structure_components ?? []) set.add(c.id);
      requiredByClass.set(st.class_id, set);
    }
  }

  // Paid (non-void) component ids per student this AY.
  const paidByStudent = new Map<string, Set<string>>();
  const { data: items, error: itemsErr } = await supabase
    .from("invoice_items")
    .select("component_id, invoices!inner(student_id, academic_year, payment_status)")
    .eq("school_id", schoolId)
    .in("invoices.student_id", ids)
    .eq("invoices.academic_year", AY)
    .neq("invoices.payment_status", "void");
  if (itemsErr) throw itemsErr;
  for (const it of (items ?? []) as unknown as {
    component_id: string | null;
    invoices: { student_id: string } | null;
  }[]) {
    const sid = it.invoices?.student_id;
    if (!sid || !it.component_id) continue;
    const set = paidByStudent.get(sid) ?? new Set<string>();
    set.add(it.component_id);
    paidByStudent.set(sid, set);
  }

  for (const s of students) {
    const required = s.class_id ? requiredByClass.get(s.class_id) : undefined;
    const paid = paidByStudent.get(s.id);
    if (!required || required.size === 0) {
      result.set(s.id, "unknown");
      continue;
    }
    const paidCount = paid ? [...required].filter((c) => paid.has(c)).length : 0;
    result.set(s.id, paidCount >= required.size ? "paid" : paidCount > 0 ? "partial" : "due");
  }
  return result;
}
