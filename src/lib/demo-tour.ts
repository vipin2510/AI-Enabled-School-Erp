// Guided-tour definition for the demo sandbox. The 4 modules aren't 4 sidebar
// links — you switch between them via the topbar department selector — so the
// tour is a sequence of "stops", each pinned to one {dept, href}. The DemoTour
// client component (src/components/demo-tour.tsx) drives each stop's steps with
// driver.js and, on the last step of a stop, advances to the next stop
// (navigating + switching department as needed).
//
// Strings here are English source; they're translated at render via t(), so the
// English text doubles as the i18n key.

import type { Department } from "@/lib/access";

export type TourStep = {
  // CSS selector of the element to highlight (a [data-tour="..."] hook).
  selector: string;
  title: string;
  body: string;
};

export type TourStop = {
  dept: Department;
  href: string;
  steps: TourStep[];
};

export const TOUR_STATE_KEY = "erp_demo_tour_state"; // {stop:number} while active
export const TOUR_SEEN_KEY = "erp_demo_tour_seen"; // "1" after finish/skip

export const TOUR_STOPS: TourStop[] = [
  {
    dept: "fees",
    href: "/fees",
    steps: [
      {
        selector: '[data-tour="dept-switcher"]',
        title: "Your 4 modules",
        body: "Switch between Fees, Academics, Library and Results from here anytime.",
      },
      {
        selector: '[data-tour="fees-stats"]',
        title: "Fees at a glance",
        body: "Paid, unpaid and outstanding amounts for the current month.",
      },
      {
        selector: '[data-tour="fees-export"]',
        title: "Export pending fees",
        body: "Download class-wise pending fees as a CSV in one click.",
      },
      {
        selector: '[data-tour="nav:/fees/collect"]',
        title: "Collect a fee",
        body: "Let's open the fee-collection screen.",
      },
    ],
  },
  {
    dept: "fees",
    href: "/fees/collect",
    steps: [
      {
        selector: '[data-tour="fees-collect-search"]',
        title: "Find a student",
        body: "Search by name, mobile or class, then take the payment and print a receipt.",
      },
    ],
  },
  {
    dept: "academics",
    href: "/academics",
    steps: [
      {
        selector: '[data-tour="dept-switcher"]',
        title: "Academics",
        body: "Now we're in the Academics module — attendance, students, classes and ID cards.",
      },
      {
        selector: '[data-tour="academics-stats"]',
        title: "Today at a glance",
        body: "Live headcount with today's present and absent counts.",
      },
      {
        selector: '[data-tour="academics-range"]',
        title: "Pick a range",
        body: "Toggle the view between day, week and month.",
      },
      {
        selector: '[data-tour="academics-chart"]',
        title: "Attendance by class",
        body: "Per-class attendance rates, at a glance.",
      },
    ],
  },
  {
    dept: "library",
    href: "/library/dashboard",
    steps: [
      {
        selector: '[data-tour="library-stats"]',
        title: "Library",
        body: "Catalog totals — books issued, available and requested.",
      },
      {
        selector: '[data-tour="library-activity"]',
        title: "Recent activity",
        body: "A live feed of issues and returns.",
      },
      {
        selector: '[data-tour="library-request"]',
        title: "Book requests",
        body: "Log a title a student has asked the library to add.",
      },
    ],
  },
  {
    dept: "results",
    href: "/results",
    steps: [
      {
        selector: '[data-tour="results-grid"]',
        title: "Results",
        body: "Pick a class and section to enter marks and print report cards.",
      },
      {
        selector: '[data-tour="results-year"]',
        title: "Academic year",
        body: "Everything stays scoped to the current academic year.",
      },
      {
        selector: '[data-tour="lang-toggle"]',
        title: "हिंदी / English",
        body: "Switch the whole app between English and Hindi anytime.",
      },
      {
        selector: '[data-tour="exit-demo"]',
        title: "That's the tour!",
        body: "Explore freely — and exit the demo whenever you like.",
      },
    ],
  },
];

// Which stop (index) belongs to the given pathname, or -1 if none. Exact match
// first, then a startsWith fallback so deep links still resolve.
export function findStopForPath(pathname: string): number {
  const exact = TOUR_STOPS.findIndex((s) => s.href === pathname);
  if (exact !== -1) return exact;
  return TOUR_STOPS.findIndex((s) => s.href !== "/" && pathname.startsWith(s.href));
}
