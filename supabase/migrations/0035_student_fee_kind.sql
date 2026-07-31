-- Per-student fee kind (new vs old) for fee collection.
--
-- Decides whether one-time charges (registration / admission) apply. It is
-- chosen once and then reused on every collection; only an admin may change it
-- afterwards (enforced in the server action). Null means "not chosen yet" — the
-- collect screen falls back to students.is_new_admission until it's set.
--
-- Apply manually — see CLAUDE.md.

alter table erp.students
  add column if not exists fee_kind text
  check (fee_kind is null or fee_kind in ('new', 'old'));

notify pgrst, 'reload schema';
