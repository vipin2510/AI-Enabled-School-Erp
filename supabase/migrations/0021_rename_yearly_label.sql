-- Rename the legacy "Yearly Fee (Books/Dev)" component to a label that
-- spells out what the bucket actually covers — ID card, sports activity,
-- culture programme, other activities and the development fee. Schema is
-- unchanged; this is a label-only rewrite for existing rows.
update public.fee_structure_components
   set label = 'Annual Activities & Development Fee'
 where kind = 'yearly'
   and label = 'Yearly Fee (Books/Dev)';
