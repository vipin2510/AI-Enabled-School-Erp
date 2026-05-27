// Roles (the three login "layers") and departments, plus the nav each
// department exposes. Shared by the sidebar, topbar, DAL and admin screens so
// there is a single source of truth for who can see/switch what.

export type Role = "admin" | "manager" | "staff";
export type Department = "fees" | "academics" | "library" | "results";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin (Layer 1)",
  manager: "Manager (Layer 2)",
  staff: "Staff (Layer 3)",
};

export const DEPARTMENTS: { id: Department; label: string }[] = [
  { id: "fees", label: "Fees" },
  { id: "academics", label: "Academics" },
  { id: "library", label: "Library" },
  { id: "results", label: "Results" },
];

export const DEPARTMENT_LABELS: Record<Department, string> = {
  fees: "Fees",
  academics: "Academics",
  library: "Library",
  results: "Results",
};

export type NavItem = { href: string; label: string };

// Department-scoped navigation. Each department leads with its own dashboard.
export const DEPARTMENT_NAV: Record<Department, NavItem[]> = {
  fees: [
    { href: "/fees", label: "Dashboard" },
    { href: "/fees/structures", label: "Fee Structures" },
    { href: "/fees/collect", label: "Collect Fee" },
    { href: "/receipts", label: "Receipts" },
    { href: "/settings/late-fee", label: "Settings" },
  ],
  academics: [
    { href: "/academics", label: "Dashboard" },
    { href: "/academics/students", label: "Students" },
    { href: "/academics/attendance", label: "Attendance" },
    { href: "/academics/classes", label: "Classes & Sections" },
    { href: "/academics/subjects", label: "Subjects" },
    { href: "/academics/id-cards", label: "ID Cards" },
  ],
  library: [
    { href: "/library/dashboard", label: "Dashboard" },
    { href: "/library", label: "Issue / Return" },
    { href: "/library/books", label: "Catalog" },
    { href: "/library/barcodes", label: "Print Labels" },
    { href: "/library/settings", label: "Settings" },
  ],
  results: [{ href: "/results", label: "Results" }],
};

// Who marks their own daily attendance from their device (Layer 2 + Layer 3);
// Layer 1 (admin) only reviews it.
export function marksOwnAttendance(role: Role): boolean {
  return role === "manager" || role === "staff";
}

export const COOKIE_DEPARTMENT = "erp_dept";

export function isDepartment(value: string | null | undefined): value is Department {
  return (
    value === "fees" || value === "academics" || value === "library" || value === "results"
  );
}

// Which departments a profile may switch between.
export function allowedDepartments(role: Role, department: Department | null): Department[] {
  if (role === "admin" || role === "manager") {
    return DEPARTMENTS.map((d) => d.id);
  }
  return department ? [department] : [];
}
