-- Fixes a bug in 067's backfill: work_entries.invoice_no can be an empty string (not NULL)
-- for orders with no invoice number, and COALESCE only falls through on NULL — so those rows
-- got mirrored with a blank "Advance payment — Order " description instead of falling back to
-- the "#<sl>" label. Re-applies the same backfill with NULLIF(invoice_no, '') added, scoped
-- only to the rows 067 actually left blank so anything already fixed by hand is left alone.
UPDATE public.income i
SET description = 'Advance payment — Order ' || COALESCE(NULLIF(we.invoice_no, ''), '#' || we.sl::text)
FROM public.work_entries we
WHERE i.work_entry_id = we.id
  AND i.source = 'Advance'
  AND i.description = 'Advance payment — Order ';
