# File storage: Cloudflare R2 (migrated off Supabase Storage)

Student/parent photos and class-teacher/principal signatures are stored in
**Cloudflare R2** (S3-compatible, 10 GB free, **zero egress fees**). The app
falls back to the old Supabase Storage bucket automatically when the `R2_*` env
vars are absent, so deploying this change is non-breaking until you flip the env.

All upload + URL logic lives in one place: `src/lib/storage.ts`.

## Why R2 (vs Cloudinary)

- **Zero egress fees** — serving images to parents/staff never burns a bandwidth
  quota (Cloudinary's free tier shares 25 credits across storage *and*
  bandwidth).
- **S3-compatible** — same protocol Supabase Storage already used, so the code
  change is minimal and low-risk.
- Our files are stored-and-served as-is (photos, signatures), so we don't need
  Cloudinary's on-the-fly transforms.

## One-time setup

1. **Create an R2 bucket** in the Cloudflare dashboard (R2 → Create bucket),
   e.g. `pathshala-erp`.
2. **Enable public access**: bucket → Settings → enable the **r2.dev** public
   URL (or connect a custom domain). Copy that base URL — it's your
   `R2_PUBLIC_BASE_URL` (no trailing slash).
3. **Create an API token**: R2 → Manage API Tokens → Create token with
   **Object Read & Write** on that bucket. Copy the Access Key ID + Secret.
4. **Set env vars** (locally in `.env.local`, and in your Vercel project):

   ```
   R2_ACCOUNT_ID=<cloudflare account id>
   R2_ACCESS_KEY_ID=<token access key id>
   R2_SECRET_ACCESS_KEY=<token secret>
   R2_BUCKET=pathshala-erp
   R2_PUBLIC_BASE_URL=https://pub-xxxxxxxx.r2.dev
   ```

   Once these are set, all new uploads go to R2. Leave them unset to keep using
   Supabase Storage.

## Migrate existing files (optional but recommended)

Existing rows still hold old Supabase URLs. While the Supabase project still
serves them they keep working, but to move them onto R2 (and survive the
Supabase project being paused) run the one-time copy script:

```bash
DRY_RUN=1 npx tsx scripts/migrate-storage-to-r2.ts   # preview
npx tsx scripts/migrate-storage-to-r2.ts             # copy files + rewrite DB URLs
```

It downloads each referenced file from its Supabase public URL, uploads it to R2
under the **same key**, and updates the `*_photo_url` / `*_signature_url`
columns. It's idempotent — safe to re-run; already-migrated URLs are skipped.

## Notes

- Object keys keep a logical bucket prefix (`student-photos/…`, `signatures/…`)
  so the same key maps to both R2 and the legacy Supabase bucket.
- `next.config.ts` whitelists both the Supabase host (legacy URLs) and the R2
  public host for `next/image` optimization.
- ID-card PDFs previously downsized photos via Supabase's `/render/image/`
  transform endpoint; R2 has no equivalent, so those URLs now pass through
  unchanged and are inlined at full (≤2 MB) size — acceptable for print.
