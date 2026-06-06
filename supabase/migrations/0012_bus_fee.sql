-- Per-student bus fee opt-in. Stored as a monthly amount on the student row;
-- the collect form multiplies it by the number of monthly slots selected and
-- adds a synthetic "Bus Fee" line item to the invoice. NULL = not on the bus.
alter table public.students
  add column if not exists bus_fee_amount integer null;

comment on column public.students.bus_fee_amount is
  'Per-month bus fee in INR. NULL = student does not use bus service.';
