# Pathshala ERP — Adeshwar Public School

Next.js 16 + Supabase + Tailwind. Fees module is the first module implemented.

## Setup

1. Copy `.env` → `.env.local` (already done).
2. Open the Supabase project at the URL in `.env.local` → **SQL Editor** and run, in order:
   - `supabase/migrations/0001_init_fees.sql`
   - `supabase/migrations/0002_seed_classes_and_fees.sql`
3. Import student roster:
   ```bash
   npm run seed:students
   ```
4. Start the dev server:
   ```bash
   npm run dev
   ```

## Features (Fees v1)

- **Students** list with class/section filter (`/students`).
- **Fee Structures** for 2026-27 (`/fees/structures`): school (per class) + hostel (per group × new/old).
- **Collect Fee** (`/fees/collect/<student>`):
  - Pick any combination of monthly fees, instalments, or one-time items.
  - "Pay full year", "All months", "All instalments" shortcuts.
  - Toggle waive-off per item OR for late fee.
  - Late fee auto-computed ₹100/day past due (editable in `/settings/late-fee`).
- **Receipts** (`/receipts`) — PDF generated with the APS letterhead (`/api/receipts/<id>/pdf`).

## Schema

See `supabase/migrations/0001_init_fees.sql`. Key tables:
- `students`, `classes`
- `fee_structures` + `fee_structure_components`
- `invoices` + `invoice_items` + `payments`
- `late_fee_settings`

RLS is disabled for v1 (no auth yet). Enable + write policies before going live.
ch
