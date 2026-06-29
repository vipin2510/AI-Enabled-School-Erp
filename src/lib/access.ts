// Roles (the three login "layers") and departments, plus the nav each
// department exposes. Shared by the sidebar, topbar, DAL and admin screens so
// there is a single source of truth for who can see/switch what.

export type Role = "admin" | "manager" | "staff";
export type Department = "fees" | "academics" | "library" | "results";

// A GROUP is the top tenant boundary — an independent franchise (Adeshwar,
// Tagore) with its own branding, login and schools. Data never crosses group
// boundaries: an admin of one group never sees another group's schools. Mirror
// of the `groups` table seeded in 0026_groups_and_quarterly.sql.
export type GroupId = string;
export type Group = {
  id: GroupId;
  code: string;           // url-safe slug ("adeshwar" | "tagore")
  name: string;           // full display name
  shortName: string;      // compact label for chrome
  // Public path to the logo (served from `public/`), e.g. /branding/tagore/logo.png.
  logoPath: string;
  // What to call a tenant unit in this group's UI: Adeshwar switches between
  // "School"s, Tagore between "Institute"s (school / pharmacy / management).
  unitLabel: string;
  location: string;
  // Host that resolves to this group pre-login (e.g. "erp.tagore.in"). null =
  // the default group served on the primary domain.
  domain?: string | null;
};

export const ADESHWAR_GROUP_ID = "10000000-0000-0000-0000-000000000001";
export const TAGORE_GROUP_ID = "10000000-0000-0000-0000-000000000002";

export const GROUPS: Group[] = [
  {
    id: ADESHWAR_GROUP_ID,
    code: "adeshwar",
    name: "Adeshwar Public School",
    shortName: "Adeshwar",
    logoPath: "/branding/aadeshwar/logo.jpeg",
    unitLabel: "School",
    location: "Kondagaon, Chhattisgarh",
    domain: null,
  },
  {
    id: TAGORE_GROUP_ID,
    code: "tagore",
    name: "Tagore Group of Institutions",
    shortName: "Tagore",
    logoPath: "/branding/tagore/logo.png",
    unitLabel: "Institute",
    location: "Sakri, Bilaspur, Chhattisgarh",
    // Tagore's own custom domain — login on this host shows Tagore branding.
    // (A custom domain is served publicly; the *.vercel.app URLs are gated by
    // the team's deployment protection.)
    domain: "erp.tipr.in",
  },
];

export const DEFAULT_GROUP_ID = ADESHWAR_GROUP_ID;

export function findGroup(idOrCode: string | null | undefined): Group | null {
  if (!idOrCode) return null;
  return GROUPS.find((g) => g.id === idOrCode || g.code === idOrCode) ?? null;
}

// Resolve the group for a request host (pre-login branding). Matches the
// group's configured `domain` (suffix match so previews/subdomains work);
// falls back to the default group.
export function groupForHost(host: string | null | undefined): Group {
  const h = (host ?? "").toLowerCase().split(":")[0];
  if (h) {
    const hit = GROUPS.find((g) => g.domain && (h === g.domain || h.endsWith(`.${g.domain}`)));
    if (hit) return hit;
  }
  return findGroup(DEFAULT_GROUP_ID)!;
}

// Each school is a tenant within a group: data never crosses school boundaries.
// Layer 3 (staff) is pinned to exactly one school, Layer 2 (manager) sees a
// subset, Layer 1 (admin) sees all schools IN THEIR GROUP. The id values match
// the seeded UUIDs in supabase/migrations/0011_schools.sql + 0026.
export type SchoolId = string;
export type School = {
  id: SchoolId;
  // The group this school belongs to (FK to GROUPS).
  groupId: GroupId;
  code: string;           // url-safe slug, also used as the cookie value
  name: string;
  // Short location ("Kondagaon, Chhattisgarh") — shown under the school
  // name on header banners.
  location: string;
  // Full address line for printable docs (ID cards, letterhead).
  addressLine?: string;
  pinCode?: string;
  mobile?: string;
  email?: string;
  board?: string;
  boardCode?: string;
  parentNote?: string;
};

export const SCHOOLS: School[] = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    groupId: ADESHWAR_GROUP_ID,
    code: "kondagaon",
    name: "Adeshwar Public School",
    location: "Kondagaon, Chhattisgarh",
    addressLine: "Kondagaon, Dist- Kondagaon (C.G)",
    pinCode: "494226",
    mobile: "9111005303",
    email: "apskondagaon@gmail.com",
    board: "CISCE",
    boardCode: "CG 024",
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    groupId: ADESHWAR_GROUP_ID,
    code: "pharasgaon",
    name: "Adeshwar Public School",
    location: "Pharasgaon, Chhattisgarh",
    addressLine: "Pharasgaon, Dist- Kondagaon (C.G)",
    pinCode: "494226",
    mobile: "9111005303",
    email: "apskondagaon@gmail.com",
    board: "CISCE",
    boardCode: "CG 024",
    parentNote: "A Unit of Adeshwar Public School, Kondagaon, C.G.",
  },
  {
    id: "00000000-0000-0000-0000-000000000003",
    groupId: ADESHWAR_GROUP_ID,
    code: "chipawand",
    name: "Adeshwar Public School",
    location: "Chipawand, Chhattisgarh",
    addressLine: "Chipawand, Dist- Kondagaon (C.G)",
    pinCode: "494226",
    mobile: "9111005303",
    email: "apskondagaon@gmail.com",
    board: "CISCE",
    boardCode: "CG 024",
    parentNote: "A Unit of Adeshwar Public School, Kondagaon, C.G.",
  },

  // ---- Tagore Group of Institutions (Sakri, Bilaspur, C.G.) ----------------
  {
    id: "00000000-0000-0000-0000-0000000000a1",
    groupId: TAGORE_GROUP_ID,
    code: "tipr",
    name: "Tagore Institute of Pharmacy & Research",
    location: "Sakri, Bilaspur, Chhattisgarh",
    addressLine: "Sakri, Bilaspur (C.G)",
    pinCode: "495003",
    mobile: "6232060011",
    email: "info@tipr.in",
    board: "CSVTU",
    parentNote: "PCI & DTE Approved · B.Pharm / D.Pharm",
  },
  {
    id: "00000000-0000-0000-0000-0000000000a2",
    groupId: TAGORE_GROUP_ID,
    code: "tisbsp",
    name: "Tagore International School",
    location: "Sakri, Bilaspur, Chhattisgarh",
    addressLine: "Sakri, Bilaspur (C.G)",
    pinCode: "495003",
    mobile: "6232061100",
    email: "info.tisbsp@gmail.com",
    board: "CBSE",
    boardCode: "3330506",
    parentNote: "Play School to Class 10",
  },
  {
    id: "00000000-0000-0000-0000-0000000000a3",
    groupId: TAGORE_GROUP_ID,
    code: "tcmbsp",
    name: "Tagore College of Management",
    location: "Sakri, Bilaspur, Chhattisgarh",
    addressLine: "Sakri, Bilaspur (C.G)",
    pinCode: "495003",
    mobile: "6232060077",
    email: "tcmbsp56@gmail.com",
    board: "CSVTU",
    parentNote: "AICTE Approved · MBA",
  },
];

export const COOKIE_SCHOOL = "erp_school";

export function findSchool(idOrCode: string | null | undefined): School | null {
  if (!idOrCode) return null;
  return SCHOOLS.find((s) => s.id === idOrCode || s.code === idOrCode) ?? null;
}

// Schools a profile may switch between, ALWAYS scoped to the profile's group so
// data never crosses group boundaries. Admin sees every school in their group
// (so onboarding another school in the group doesn't require touching every
// profile row); manager/staff see only the explicit ids stored on their
// profile (which are within their group anyway).
export function allowedSchools(
  role: Role,
  schoolIds: SchoolId[],
  groupId: GroupId,
): School[] {
  const inGroup = SCHOOLS.filter((s) => s.groupId === groupId);
  if (role === "admin") return inGroup;
  const set = new Set(schoolIds);
  return inGroup.filter((s) => set.has(s.id));
}

// The group of a school id, or null.
export function groupOfSchool(schoolId: SchoolId | null | undefined): Group | null {
  const school = findSchool(schoolId);
  return school ? findGroup(school.groupId) : null;
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
    { href: "/settings/fees-print-layout", label: "Print Layout", leaderOnly: true },
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
  results: [
    { href: "/results", label: "Results" },
  ],
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
