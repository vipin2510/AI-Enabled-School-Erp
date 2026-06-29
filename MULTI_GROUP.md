# Multi-Group Tenancy (Adeshwar + Tagore)

This ERP now hosts **multiple independent groups (franchises)** from one codebase,
one Vercel project, and one Supabase database. A **group** is the top tenant
boundary; each group owns its branding (logo, name, domain) and a set of
**schools / institutes**. Data never crosses group boundaries.

```
Group (Adeshwar)                     Group (Tagore)
  ├─ Adeshwar Public School, Kondagaon   ├─ Tagore Institute of Pharmacy & Research (tipr.in)
  ├─ … Pharasgaon                        ├─ Tagore International School           (tisbsp.in)
  └─ … Chipawand                         └─ Tagore College of Management          (tcmbsp.in)
        monthly fees                            quarterly fees
```

## Where things live

| Concern | Location |
|---|---|
| Group + school registry | `src/lib/access.ts` (`GROUPS`, `SCHOOLS`, `allowedSchools`) |
| Active group / branding helper | `src/lib/auth.ts` (`getCurrentGroup`), `groupForHost` in access.ts |
| Per-tenant assets & config | `branding/aadeshwar/`, `branding/tagore/` (+ mirrored in `public/branding/`) |
| Schema | `supabase/migrations/0026_groups_and_quarterly.sql` |
| Quarterly fees | `kind = 'quarterly'`, `period_index` 1..4 (Q1 Apr–Jun … Q4 Jan–Mar) |

Branding is **data-driven**: the group's `logoPath`/`name` flow into the login
page (resolved by host), the sidebar, the school picker, and the fee receipt.

## One-time setup (things only you can do)

### 1. Apply the migrations (Supabase SQL editor)
Run in order if not already applied:
- `0025_restore_profiles_anon_select.sql` — the login fix.
- `0026_groups_and_quarterly.sql` — groups, `group_id`, Tagore institutes, `quarterly`.

Both are **additive and safe**: every existing Adeshwar school/profile is
backfilled to the Adeshwar group, so the live app is unchanged.

### 2. Add the Tagore domain in Vercel (same project)
Architecture chosen = **one Vercel project, multiple domains**:
1. Vercel → the existing project → **Settings → Domains** → add e.g. `erp.tagore.in`
   (and keep the Adeshwar domain).
2. Point the domain's DNS at Vercel (CNAME `cname.vercel-dns.com`).
3. Set each group's `domain` in `src/lib/access.ts` (`GROUPS[].domain`) so the
   **login page** shows the right logo before sign-in. Example:
   `{ code: "tagore", domain: "erp.tagore.in", … }`.

There is **no second deployment to manage** — both groups serve from the same
build. The "Tagore Vercel URL" is simply that domain once attached.

### 3. Bootstrap the first Tagore admin
```bash
GROUP=tagore npx tsx scripts/create-admin.ts <phone-or-email> <password> "Name"
```
That admin sees only Tagore institutes; logins they create stay in Tagore.

### 4. Seed Tagore classes + quarterly fee structures
Tagore's institutes exist but have no classes/fees yet. The exact fee amounts
live in PDFs on each institute's `/fee-structure` page (not machine-readable).
Provide the numbers (or the PDFs) and seed via **Fees → Structures**, using
`kind = quarterly` with `period_index` 1..4.

## What's wired vs. pending

**Wired:** group model + DB schema, group-scoped access (admins never see another
group's schools/users), data-driven branding on login / sidebar / school-picker /
**fee receipt**, quarterly period in the schema + invoices API + receipt rendering,
group-aware user creation + `create-admin` script.

**Pending (next iterations):**
- Quarterly **collect UI** in `fees/collect` (the structures editor + collect form
  still surface monthly/instalment; quarterly periods need their own selector).
- Branding for the **other PDFs** (ID card, book label, timetable, results) and the
  hardcoded dashboard titles — they still fall back to Adeshwar text. Harmless until
  Tagore has data, but should be made group-aware.
- Tagore receipt logo is a **wide banner**; the receipt's square logo slot may need a
  group-specific logo variant for best fit.
