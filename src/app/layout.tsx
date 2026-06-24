import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar, { type NavGroup } from "@/components/sidebar";
import Topbar from "@/components/topbar";
import IdleWatcher from "@/components/idle-watcher";
import { getProfile, getCurrentDepartment, getCurrentSchool } from "@/lib/auth";
import { getStaffAttendanceMarkedAt } from "@/lib/cache";
import { todayStr } from "@/lib/attendance";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import {
  DEPARTMENT_NAV,
  DEPARTMENT_LABELS,
  allowedDepartments,
  allowedSchools,
  marksOwnAttendance,
} from "@/lib/access";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pathshala ERP — Adeshwar Public School",
  description: "School ERP — Fees, Admissions, Receipts",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const profile = await getProfile();

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        {profile ? (
          <AppShell profile={profile}>{children}</AppShell>
        ) : (
          // Logged out: the only page reachable (per proxy.ts) is /login,
          // which renders bare without the sidebar/topbar shell.
          children
        )}
      </body>
    </html>
  );
}

async function AppShell({
  profile,
  children,
}: {
  profile: NonNullable<Awaited<ReturnType<typeof getProfile>>>;
  children: React.ReactNode;
}) {
  const department = await getCurrentDepartment(profile);
  const allowed = allowedDepartments(profile.role, profile.department);
  const isLeader = profile.role === "admin" || profile.role === "manager";

  // Resolve the active school. Leaders without one picked yet get bounced to
  // /select-school. Staff always have one (pinned by their profile).
  const school = await getCurrentSchool(profile);
  const schools = allowedSchools(profile.role, profile.school_ids);
  if (!school) {
    const headerStore = await headers();
    const pathname = headerStore.get("x-pathname") ?? "";
    if (!pathname.startsWith("/select-school")) {
      redirect("/select-school");
    }
    // No school + on /select-school: render the page bare without the shell.
    return <>{children}</>;
  }

  // Build the sidebar: an Overview (leaders), the active department's nav, the
  // admin-only Administration block, and Change Requests — which every login
  // can reach. Academics is one of the switchable departments now.
  const groups: NavGroup[] = [];

  if (isLeader) {
    groups.push({ items: [{ href: "/", label: "Overview" }] });
  }

  const deptItems = DEPARTMENT_NAV[department].filter((n) => isLeader || !n.leaderOnly);
  groups.push({ label: DEPARTMENT_LABELS[department], items: deptItems });

  if (profile.role === "admin") {
    groups.push({
      label: "Administration",
      items: [
        { href: "/admin/users", label: "Users & Logins" },
        { href: "/admin/staff-attendance", label: "Staff Attendance" },
      ],
    });
  }

  groups.push({ items: [{ href: "/requests", label: "Change Requests" }] });

  // Layer 2/3 mark their own attendance from the topbar; surface whether
  // they've already done so today. Cached for 60s per (school, profile, date)
  // so the shell isn't paying for a fresh DB roundtrip on every navigation —
  // the mark-attendance action busts the tag immediately on success.
  let markedAt: string | null = null;
  if (marksOwnAttendance(profile.role)) {
    markedAt = await getStaffAttendanceMarkedAt(school.id, profile.id, todayStr());
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar groups={groups} />
      <div className="flex flex-1 flex-col">
        <Topbar
          fullName={profile.full_name ?? ""}
          email={profile.email ?? profile.phone ?? ""}
          role={profile.role}
          department={department}
          allowed={allowed}
          school={school}
          allowedSchools={schools}
          canMarkAttendance={marksOwnAttendance(profile.role)}
          markedAt={markedAt}
        />
        <main className="flex-1 px-6 py-6 md:px-10">{children}</main>
      </div>
      <IdleWatcher />
    </div>
  );
}
