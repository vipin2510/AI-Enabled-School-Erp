# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> The line above is not optional reading. This repo runs **Next.js 16**, whose
> APIs differ from older training data (see "Framework gotchas" below). Read the
> relevant guide under `node_modules/next/dist/docs/` before writing framework code.

## Commands

```bash
npm run dev            # local dev server
npm run build          # production build (also the fastest full typecheck of every route)
npm run lint           # eslint (CI gate — must pass)
npx tsc --noEmit       # typecheck without building
npm run seed:students  # import the student roster (scripts/seed-students.ts)
npm run create:admin   # bootstrap the first admin login (scripts/create-admin.ts, needs service-role key)
```

There is **no test suite**. The two safety nets are `npm run lint` and `npm run build`; run both before committing.

## What this is

Pathshala ERP for Adeshwar Public School — Next.js 16 (App Router) + Supabase (Postgres + Auth + Storage) + Tailwind v4. Modules: Fees, Academics, Library, Results, plus user administration. `@/*` resolves to `src/*`.

## Architecture

### Roles, departments, and access — the spine of the app
`src/lib/access.ts` is the **single source of truth** for the two orthogonal access dimensions; change it here and the sidebar, topbar switcher, user-creation form, and route guards all follow:
- **Roles ("layers")**: `admin` (Layer 1), `manager` (Layer 2), `staff` (Layer 3).
- **Departments**: `fees`, `academics`, `library`, `results`. Each has its own nav in `DEPARTMENT_NAV` and a dashboard as its first item. Admin/manager can switch between all departments; staff are pinned to one.

`src/lib/auth.ts` provides the guards every page/action starts with:
- `requireProfile()` — any logged-in user, else redirect `/login`.
- `requireRole(...roles)` — gate by layer (e.g. admin-only Administration).
- `requireDepartment(dept)` — admin/manager pass; staff must belong to that department. **This is how department modules are gated** (don't use `requireRole` for department pages).
- `getCurrentDepartment(profile)` — staff are pinned; admin/manager read the `erp_dept` cookie (set via the topbar switcher → `setDepartment` action).

The home route `/` is the combined **Overview** for admin/manager; staff are redirected to their department's dashboard. The shell (sidebar + topbar) is built in `src/app/layout.tsx` from the guards above.

### Supabase clients — pick the right one
- `src/lib/supabase/server.ts` — per-request, **anon key**, carries the user session. Default for pages and most actions.
- `src/lib/supabase/admin.ts` — **service-role key**, bypasses RLS, has the Auth admin API. Only for creating/managing users and Storage uploads. Never import into client code.
- `src/lib/supabase/client.ts` — browser client.

**RLS is intentionally permissive** (`anon_all_*` policies allow all). Authorization is enforced in the **app layer** via the auth guards, *not* in the database. Don't assume the DB will reject an unauthorized read/write — the guard in the page/action is the only thing stopping it.

> Note: this Supabase project is **shared with another, unrelated app** (tables like `users`, `complaints`, `thana`, `wp_logs`). Only the ERP tables below are ours — leave the others alone.

### Database / migrations
SQL lives in `supabase/migrations/`, numbered and applied **in order**. They are applied **manually** (Supabase SQL editor or the Supabase MCP) — the migration-tracking table is not used, so a file existing in the repo does **not** mean it's been applied to the live DB. After adding a migration, apply it explicitly. Core tables: `profiles`, `students`, `classes`/`sections`/`subjects`, `fee_structures`/`fee_structure_components`, `invoices`/`invoice_items`/`payments`, `attendance`, `staff_attendance`, `books`/`book_loans`/`book_requests`/`library_settings`, `marks`, `change_requests`.

### Conventions to match
- **Server actions** are co-located in `actions.ts` per route, marked `"use server"`, and call a guard first. Mutations end with `revalidatePath(...)`. Client forms wire them via `useActionState`. Auth/cross-cutting actions live in `src/app/actions/`.
- **Pages** are `export const dynamic = "force-dynamic"` (live data, no static caching) and parallelize Supabase reads with `Promise.all`.
- **PDFs** (`receipt`, `id-card`, `result-card`, `book-label`) are `@react-pdf/renderer` components in `src/components/*-pdf.tsx`, rendered to a stream by `src/app/api/**/route.ts` handlers.
- **CSV/XLSX**: imports use the `xlsx` package; CSV exports are GET route handlers returning `text/csv` with a UTF-8 BOM (`"﻿"`) so Excel reads Hindi names / ₹ correctly (see `src/app/api/exports/pending/route.ts` and `src/app/api/academics/attendance-export/route.ts`).
- **Shared UI**: `StatCard` (toned dashboard metric), `BarChart` (dependency-free CSS bars), `src/components/ui/*` primitives. Cards use the `.card` class from `globals.css`; the palette is stone + the `--color-accent` orange.

### Framework gotchas (Next.js 16 — not your training data)
- Middleware is renamed **Proxy**: `src/proxy.ts` exports `proxy()`. It refreshes the Supabase session and redirects anonymous users to `/login`.
- `searchParams`, `params`, and `cookies()` are **async** (`await` them / they're `Promise`s).
