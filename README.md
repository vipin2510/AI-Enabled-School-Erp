# Pathshala ERP

A school ERP built with **Next.js 16** (App Router) + **Supabase** (Postgres + Auth + Storage) + **Tailwind v4**.

Modules: **Fees**, **Academics**, **Library**, **Results**, plus user administration. `@/*` resolves to `src/*`.

> See `CLAUDE.md` / `AGENTS.md` for engineering conventions. This is Next.js 16 — APIs differ from older versions (Middleware is `proxy.ts`; `searchParams`/`params`/`cookies()` are async).

## Commands

```bash
npm run dev            # local dev server
npm run build          # production build (also the fullest typecheck)
npm run lint           # eslint (CI gate)
npx tsc --noEmit       # typecheck only
npm run seed:students  # import the student roster
npm run create:admin   # bootstrap the first admin login (needs service-role key)
```

There is no test suite — `npm run lint` and `npm run build` are the safety nets. Run both before committing.

## Setup (local)

1. Copy `.env` → `.env.local` and fill in the Supabase URL + keys.
2. In the Supabase project → **SQL Editor**, run every file in `supabase/migrations/` **in numeric order** (`0001…` upward). Migrations are applied **manually** — a file existing in the repo does not mean it has been applied.
3. Bootstrap the first admin: `npm run create:admin`.
4. Import the student roster: `npm run seed:students`.
5. `npm run dev`.

## Architecture

- **Roles ("layers")** — `admin` (1), `manager` (2), `staff` (3). **Departments** — `fees`, `academics`, `library`, `results`. Both live in `src/lib/access.ts` (single source of truth); the sidebar, topbar switcher, and route guards follow it.
- **Guards** (`src/lib/auth.ts`): `requireProfile()`, `requireRole(...)`, `requireDepartment(dept)`. Authorization is enforced in the **app layer**, not the DB — RLS is intentionally permissive.
- **Supabase clients** (`src/lib/supabase/*`): `server.ts` (anon, per-request session — default), `admin.ts` (service-role, never in client code), `client.ts` (browser).
- **PDFs** — `@react-pdf/renderer` components in `src/components/*-pdf.tsx`, streamed by `src/app/api/**/route.ts` handlers (receipts, ID cards, result marksheet, book labels).

## Multi-tenancy (groups → schools)

Two nested tenant boundaries, both defined in `src/lib/access.ts`:

- **Group** — an independent **franchise/firm** (e.g. *Adeshwar*, *Tagore*) with its own branding, logins, and schools. **Data never crosses group boundaries** — an admin of one group never sees another group's data.
- **School** — a **branch/unit within a group** (e.g. Adeshwar's Kondagaon / Pharasgaon / Chipawand). Isolated by `school_id` on every domain table. Staff are pinned to one school; admins see all schools in their group.

Per-school configuration is **data-driven** (rows keyed by `school_id`), never code branches: `late_fee_settings`, `library_settings`, `fee_print_settings`, `report_extras`, etc.

## Deploying for a new school / firm

Pick the right boundary:

- **Another branch of an existing firm** → just add a `schools` row (same group) and seed its data. One deployment, one database, separated by `school_id`. No code fork.
- **A different, unrelated firm** → give it its **own Supabase project + its own deployment** from the **same codebase** (single-tenant-per-deployment). This keeps each firm's data fully isolated — important because RLS here is permissive and auth is app-layer.

Steps to stand up a new firm:

1. Create a new **Supabase project**.
2. Run **all** `supabase/migrations/*.sql` against it, in order.
3. Create a new **deployment** (e.g. a separate Vercel project + domain) with that firm's env vars (`NEXT_PUBLIC_SUPABASE_URL`, keys). Secrets live in deploy env vars — never in git.
4. Add the firm as a **group** + its **school(s)** in `access.ts` / the `groups`/`schools` tables, with its own branding (`logoPath`, name, board). A group can bind a custom `domain` so pre-login branding resolves by host.
5. Bootstrap its admin (`npm run create:admin`), then import classes / subjects / students / fees / books via the CSV onboarding kit in `requirements/`.

### Git & versioning

One repo, **trunk-based** (`main`); every deployment runs the same code. **No per-school/per-firm branches** — per-tenant differences live in the database and deploy env, not in git. Tag releases (`v1.x`) for versioning; gate new features behind per-school flags so they roll out tenant-by-tenant without a redeploy. Separate deployments may each be pinned to a tag if a firm needs to stay on an older release.

## Database / migrations

SQL lives in `supabase/migrations/`, numbered and applied **in order, manually** (Supabase SQL Editor). The migration-tracking table is not used. Core tables: `groups`, `schools`, `profiles`, `students`, `classes`/`sections`/`subjects`, `fee_structures`/`invoices`/`payments`, `attendance`/`staff_attendance`, `books`/`book_loans`, `marks`/`report_extras`, plus the per-school settings tables above.

> Note: the shared Supabase project also contains tables from an unrelated app (`users`, `complaints`, `thana`, `wp_logs`) — leave those alone.
