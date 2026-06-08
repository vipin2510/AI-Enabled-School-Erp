-- 0014_invoice_idempotency.sql
--
-- Idempotency key for invoice creation. The Collect Fee form generates a
-- random key per "Collect" click; if the network retries (double-tap, slow
-- response, etc.) the POST /api/invoices route looks for an existing row
-- with the same key and returns it instead of writing a duplicate.
--
-- The unique index is per-school so two different tenants can never collide
-- (keys are short random tokens, but partitioning is defensive).

alter table public.invoices
  add column if not exists idempotency_key text;

-- Allow NULL for legacy / non-form writes; collisions only matter when a
-- key was actually provided.
create unique index if not exists invoices_idempotency_key_uidx
  on public.invoices (school_id, idempotency_key)
  where idempotency_key is not null;
