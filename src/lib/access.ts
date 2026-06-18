// Roles (the three login "layers") and departments, plus the nav each
// department exposes. Shared by the sidebar, topbar, DAL and admin screens so
// there is a single source of truth for who can see/switch what.

export type Role = "admin" | "manager" | "staff";
export type Department = "fees" | "academics" | "library" | "results";

// Each school is a tenant: data never crosses school boundaries. Layer 3
// (staff) is pinned to exactly one school, Layer 2 (manager) sees a subset,
// Layer 1 (admin) sees all. The id values match the seeded UUIDs in
// supabase/migrations/0011_schools.sql.
export type SchoolId = string;
export type School = {
  id: SchoolId;
  code: string;           // url-safe slug, also used as the cookie value
  name: string;
  location: string;
  board?: string;
  boardCode?: string;
  parentNote?: string;
};

export const SCHOOLS: School[] = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    code: "kondagaon",
    name: "Adeshwar Public School",
    location: "Kondagaon, Chhattisgarh",
    board: "CISCE",
    boardCode: "CG 024",
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    code: "pharasgaon",
    name: "Adeshwar Public School",
    location: "Pharasgaon, Chhattisgarh",
    parentNote: "A Unit of Adeshwar Public School, Kondagaon, C.G.",
  },
  {
    id: "00000000-0000-0000-0000-000000000003",
    code: "chipawand",
    name: "Adeshwar Public School",
    location: "Chipawand, Chhattisgarh",
    parentNote: "A Unit of Adeshwar Public School, Kondagaon, C.G.",
  },
];

export const COOKIE_SCHOOL = "erp_school";

export function findSchool(idOrCode: string | null | undefined): School | null {
  if (!idOrCode) return null;
  return SCHOOLS.find((s) => s.id === idOrCode || s.code === idOrCode) ?? null;
}

// Schools a profile may switch between. Admin always sees all (so onboarding
// a fourth school doesn't require touching every profile row). Manager/staff
// see only the explicit ids stored on their profile.
export function allowedSchools(role: Role, schoolIds: SchoolId[]): School[] {
  if (role === "admin") return SCHOOLS;
  const set = new Set(schoolIds);
  return SCHOOLS.filter((s) => set.has(s.id));
}

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

export type NavItem = { href: string; label: string; leaderOnly?: boolean };

// Department-scoped navigation. Each department leads with its own dashboard.
// `leaderOnly: true` items are filtered out for Layer 3 staff in the shell.
export const DEPARTMENT_NAV: Record<Department, NavItem[]> = {
  fees: [
    { href: "/fees", label: "Dashboard" },
    { href: "/fees/structures", label: "Fee Structures", leaderOnly: true },
    { href: "/fees/collect", label: "Collect Fee" },
    { href: "/fees/expenses", label: "Expenses" },
    { href: "/receipts", label: "Receipts" },
    { href: "/settings/late-fee", label: "Settings", leaderOnly: true },
  ],
  academics: [
    { href: "/academics", label: "Dashboard" },
    { href: "/academics/students", label: "Students" },
    { href: "/academics/attendance", label: "Attendance" },
    { href: "/academics/classes", label: "Classes & Sections" },
    { href: "/academics/subjects", label: "Subjects" },
    { href: "/academics/timetable", label: "Timetable" },
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
