-- Per-receipt discount applied at collection time. Reduces the payable total
-- after subtotal + late fee (server clamps it to never exceed the payable).
-- discount_reason is optional free text printed on the receipt.
--
-- Applied manually (Supabase SQL editor) — see CLAUDE.md. Remember the PostgREST
-- schema reload so the new columns are visible to the API immediately.
alter table erp.invoices
  add column if not exists discount numeric(12,2) not null default 0,
  add column if not exists discount_reason text;

notify pgrst, 'reload schema';
