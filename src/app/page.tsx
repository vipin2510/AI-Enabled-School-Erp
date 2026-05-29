import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { DEPARTMENT_NAV } from "@/lib/access";
import { inr, monthYearLabel } from "@/lib/utils";
import { todayStr, prettyDate } from "@/lib/attendance";
import StatCard from "@/components/stat-card";

export const dynamic = "force-dynamic";

const AY = "2026-27";

export default async function Overview() {
  const profile = await requireProfile();

  // Staff land on their own department's dashboard; the combined overview is
  // for Layer 1 (admin) and Layer 2 (manager).
  if (profile.role === "staff") {
    const dept = profile.department ?? "fees";
    redirect(DEPARTMENT_NAV[dept][0]?.href ?? "/fees");
  }

  const supabase = await createClient();
  const today = todayStr();
  const now = new Date();
  const monthIndex = now.getMonth() + 1;
  const monthLabel = monthYearLabel(now);

  const [
    studentsRes,
    structRes,
    paidRes,
    attendanceTodayRes,
    booksRes,
    loansRes,
    bookReqRes,
    staffRes,
    staffMarkedRes,
    changeReqRes,
  ] = await Promise.all([
    supabase.from("students").select("id, class_id").eq("status", "active"),
    supabase
      .from("fee_structures")
      .select("class_id, fee_structure_components(kind, amount)")
      .eq("academic_year", AY)
      .eq("scope", "school"),
    supabase
      .from("invoice_items")
      .select("invoices!inner(student_id, academic_year, payment_status)")
      .eq("kind", "monthly")
      .eq("period_index", monthIndex)
      .eq("invoices.academic_year", AY)
      .neq("invoices.payment_status", "void"),
    supabase.from("attendance").select("status").eq("date", today),
    supabase.from("books").select("id", { count: "exact", head: true }),
    supabase.from("book_loans").select("id", { count: "exact", head: true }).is("returned_at", null),
    supabase.from("book_requests").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("profiles").select("id").in("role", ["manager", "staff"]).eq("is_active", true),
    supabase.from("staff_attendance").select("profile_id").eq("date", today),
    supabase.from("change_requests").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);

  const students = studentsRes.data ?? [];
  const totalStudents = students.length;

  // Fees — paid vs outstanding for the current month.
  const monthlyByClass = new Map<string, number>();
  for (const s of (structRes.data ?? []) as unknown as {
    class_id: string | null;
    fee_structure_components: { kind: string; amount: number }[];
  }[]) {
    if (!s.class_id) continue;
    const m = s.fee_structure_components.find((c) => c.kind === "monthly");
    monthlyByClass.set(s.class_id, Number(m?.amount ?? 0));
  }
  const paidSet = new Set(
    ((paidRes.data ?? []) as unknown as { invoices: { student_id: string } }[]).map(
      (r) => r.invoices.student_id
    )
  );
  const paidCount = students.filter((s) => paidSet.has(s.id)).length;
  const outstanding = students
    .filter((s) => !paidSet.has(s.id))
    .reduce((sum, s) => sum + (s.class_id ? monthlyByClass.get(s.class_id) ?? 0 : 0), 0);

  // Attendance today.
  const attRows = (attendanceTodayRes.data ?? []) as { status: "present" | "absent" }[];
  const presentToday = attRows.filter((r) => r.status === "present").length;
  const markedToday = attRows.length;
  const attRate = markedToday ? Math.round((presentToday / markedToday) * 100) : 0;

  // Library + staff.
  const totalBooks = booksRes.count ?? 0;
  const issuedNow = loansRes.count ?? 0;
  const openBookReqs = bookReqRes.count ?? 0;
  const totalStaff = (staffRes.data ?? []).length;
  const staffPresent = new Set(
    (staffMarkedRes.data ?? []).map((r: { profile_id: string }) => r.profile_id)
  ).size;
  const staffAbsent = Math.max(totalStaff - staffPresent, 0);
  const openChangeReqs = changeReqRes.count ?? 0;

  const staffHref = profile.role === "admin" ? "/admin/staff-attendance" : undefined;

  return (
    <div className="max-w-6xl">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-stone-500 text-sm">
          Adeshwar Public School, Kondagaon — {prettyDate(today)}
        </p>
      </header>

      <Section title="Academics" href="/academics">
        <StatCard title="Total Students" value={totalStudents} icon="🎓" tone="sky" href="/academics" />
        <StatCard
          title="Present Today"
          value={markedToday ? presentToday : "—"}
          hint={markedToday ? `${attRate}% of ${markedToday} marked` : "Not marked yet"}
          icon="✅"
          tone="emerald"
          href="/academics"
        />
        <StatCard
          title="Absent Today"
          value={markedToday ? markedToday - presentToday : "—"}
          hint={markedToday ? "across marked classes" : "Not marked yet"}
          icon="🚫"
          tone="rose"
          href="/academics"
        />
      </Section>

      <Section title="Fees" href="/fees">
        <StatCard
          title={`Paid · ${monthLabel}`}
          value={`${paidCount} / ${totalStudents}`}
          icon="💰"
          tone="emerald"
          href="/fees"
        />
        <StatCard
          title={`Unpaid · ${monthLabel}`}
          value={totalStudents - paidCount}
          icon="⏳"
          tone="amber"
          href="/fees"
        />
        <StatCard
          title={`Outstanding · ${monthLabel}`}
          value={inr(outstanding)}
          icon="📉"
          tone="rose"
          href="/fees"
        />
      </Section>

      <Section title="Library" href="/library/dashboard">
        <StatCard title="Total Books" value={totalBooks} icon="📚" tone="violet" href="/library/dashboard" />
        <StatCard title="Issued Now" value={issuedNow} icon="📖" tone="sky" href="/library/dashboard" />
        <StatCard
          title="Open Book Requests"
          value={openBookReqs}
          hint="titles students want added"
          icon="📝"
          tone="amber"
          href="/library/dashboard"
        />
      </Section>

      <Section title="Staff & Administration" href={staffHref}>
        <StatCard
          title="Staff Present Today"
          value={`${staffPresent} / ${totalStaff}`}
          icon="🧑‍🏫"
          tone="emerald"
          href={staffHref}
        />
        <StatCard title="Staff Absent Today" value={staffAbsent} icon="🚷" tone="rose" href={staffHref} />
        <StatCard
          title="Open Change Requests"
          value={openChangeReqs}
          icon="✉️"
          tone="slate"
          href="/requests"
        />
      </Section>
    </div>
  );
}

function Section({
  title,
  href,
  children,
}: {
  title: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">{title}</h2>
        {href && (
          <a href={href} className="text-xs text-stone-500 hover:text-stone-800 hover:underline">
            Open →
          </a>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">{children}</div>
    </section>
  );
}
