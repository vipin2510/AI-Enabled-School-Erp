import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar, { type NavGroup } from "@/components/sidebar";
import Topbar from "@/components/topbar";
import { getProfile, getCurrentDepartment } from "@/lib/auth";
import { DEPARTMENT_NAV, ACADEMICS_NAV, DEPARTMENT_LABELS, allowedDepartments } from "@/lib/access";

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

  // Build the sidebar from the active department, plus the admin/manager-only
  // groups (academics, user management, requests).
  const groups: NavGroup[] = [
    { label: DEPARTMENT_LABELS[department], items: DEPARTMENT_NAV[department] },
  ];

  if (profile.role === "admin" || profile.role === "manager") {
    groups.push({ label: "Academics", items: ACADEMICS_NAV });
  }

  const adminGroup: NavGroup = { label: "Administration", items: [] };
  if (profile.role === "admin") {
    adminGroup.items.push({ href: "/admin/users", label: "Users & Logins" });
  }
  if (profile.role === "admin" || profile.role === "manager") {
    adminGroup.items.push({ href: "/requests", label: "Change Requests" });
  }
  if (adminGroup.items.length) groups.push(adminGroup);

  return (
    <div className="flex min-h-screen">
      <Sidebar groups={groups} />
      <div className="flex flex-1 flex-col">
        <Topbar
          fullName={profile.full_name ?? ""}
          email={profile.email ?? ""}
          role={profile.role}
          department={department}
          allowed={allowed}
        />
        <main className="flex-1 px-6 py-6 md:px-10">{children}</main>
      </div>
    </div>
  );
}
