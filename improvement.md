# Pre-deployment improvements

Backlog from the pre-deployment sanity review. Ordered by priority. Nothing here
is blocking the app from running today — these harden it for real-school use
(performance, security, correctness).

> Context: GitHub reported the repo as ~70% HTML only because one 1.6 MB
> reference mockup (`reference/Pathshala Admin Demo.html`) outweighed the source
> by bytes. That file is now untracked + gitignored and a `.gitattributes`
> keeps reference/data files out of the language stats. The codebase is
> TypeScript/React. The "everything feels slow / re-renders on every click" is a
> real architecture issue, captured under Performance below.

---

## 🔴 High — Security & data integrity (do before real schools)

- [ ] **Tighten Row-Level Security.** RLS is currently fully permissive
      (`anon_all_*` policies allow all reads/writes); authorization is enforced
      only in the app layer. The anon key is public by design, so anyone with it
      + table names can read/write student PII (names, contacts, addresses) and
      fees directly. Add school-scoped, role-aware RLS policies on the ERP
      tables. Touches every table — test each role/department path after.
      _Not started — needs a per-role/per-table policy matrix designed first._
- [ ] **Shared Supabase project risk.** This project is shared with an unrelated
      app (tables like `users`, `complaints`, `thana`, `wp_logs`). A migration,
      quota, or incident on the other app can affect school data. Decide whether
      to split into a dedicated project before onboarding real schools.
- [x] **Stop swallowing Supabase errors on money paths.** Every fees/* + receipts/*
      Supabase read now throws on `error` instead of falling back to `data ?? []`,
      so a failed query renders the route error boundary (`src/app/error.tsx`)
      instead of pretending the data is empty.

## 🟠 Medium — Performance (the "slow / re-renders every click" problem)

- [x] **Migration `0015_student_search_trgm.sql`** (pending manual apply).
      Adds `pg_trgm` + GIN indexes so the Collect Fee / Academics / Receipts
      `ILIKE '%term%'` searches are index-backed instead of seq scans. Filed
      under 0015 because 0014 was taken by the invoice idempotency migration.
- [ ] **Reduce DB round-trips per render.** Every page is
      `export const dynamic = "force-dynamic"` (no caching), so each navigation
      re-hits the DB. The Collect Fee picker alone makes ~4 sequential Supabase
      calls per render (`classes`, `students`, then `fee_structures` +
      `invoice_items` for the Paid/Partial/Due badges). Options:
      - Cache rarely-changing reads (e.g. `classes`, fee structures) instead of
        force-dynamic everywhere.
      - Move the badge aggregation into a single SQL view / RPC instead of two
        extra round-trips + in-JS merge.
      - Confirm the Supabase project region is close to the Vercel deploy region
        (round-trip latency is multiplied by the per-page query count).
- [ ] **Audit other hot pages** the same way (the Overview dashboard runs ~10
      parallel queries; the shell runs a `staff_attendance` query on every page
      for managers/staff).

## 🟡 Low — Correctness over time & hygiene

- [x] **Centralize the academic year.** `currentAcademicYear()` is the single
      source of truth (`src/lib/academic-year.ts`); the five hardcoded
      `"2026-27"` literals (`app/page.tsx`, `app/fees/page.tsx`,
      `app/fees/collect/page.tsx`, `app/fees/collect/[studentId]/page.tsx`,
      `app/api/exports/pending/route.ts`) now compute it per request, and the
      structures page header reads from it too.
- [ ] **Repo bloat.** Besides the now-untracked HTML, `reference/` still holds
      `APS letter head.docx` (48 KB) + `FEES 2026-27.xlsx` (12 KB) — neither
      is referenced by any code path. The other two xlsx files in `reference/`
      *are* used by `scripts/seed-students.ts` and must stay. There are also
      ~27 tracked CSVs under `requirements/`, but those are intentional
      onboarding data per the existing `requirements/*/README.md` files.
      (History still contains the 1.6 MB blob; only rewrite history if clone
      size actually matters.)

## ✅ Done in this review (and the follow-up pass)
- Untracked + gitignored the 1.6 MB `reference/Pathshala Admin Demo.html`.
- Added `.gitattributes` so Linguist reports TypeScript (and marks `reference/`
  as vendored, `requirements/` as generated).
- Created `supabase/migrations/0015_student_search_trgm.sql` (pending manual apply).
- Removed the abandoned mobile-preview experiment files
  (`src/components/mobile-preview.tsx`, `src/app/fees/collect/search-controls.tsx`).
- Centralized the academic year (`src/lib/academic-year.ts`); removed five
  hardcoded `"2026-27"` literals.
- Surfaced Supabase errors on every fees/* + receipts/* path instead of
  silently rendering empty lists.
- Hardened `POST /api/invoices` (department gate, school-scoped student check,
  server-recomputed totals from DB-priced components, bus-fee validation against
  the student's `bus_fee_amount`, late-fee capped at subtotal, idempotency key
  via migration `0014_invoice_idempotency.sql`).
- Moved fee-structures editor writes from the browser anon client to a
  `requireRole("admin","manager")` server action that verifies every
  `structure_id` belongs to the caller's school.
- Filtered marks save/import + attendance save against `school_id`
  (and class/section for attendance) so cross-school UUID injection writes
  zero rows.
- Added `src/app/error.tsx` + `src/app/global-error.tsx` so unhandled
  exceptions stop landing on a white page.
- Added per-month bus-fare opt-in to the Collect Fee form — each monthly slot
  now has a "+ Bus ₹X" chip, and bus charges are posted as one line per month
  (period_index = that month) instead of one blended row.
