-- Links a mirrored Income row back to the work_entries advance payment it was created from.
-- POST /api/work-log/[id]/verify-advance now mirrors a verified order advance into `income`
-- (source = 'Advance') the same way Advance/EMI/Product Buy already mirror into `expenses`
-- elsewhere in Finance Hub — this column lets that mirroring be idempotent (never duplicate a
-- verified advance into income twice) and traces a mirrored row back to its source order.
-- NULL for every other income entry (anything added manually via the Add Income form).
ALTER TABLE public.income
    ADD COLUMN IF NOT EXISTS work_entry_id UUID REFERENCES public.work_entries(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_income_work_entry_id ON public.income(work_entry_id) WHERE work_entry_id IS NOT NULL;

-- Backfill: advances verified before this feature existed didn't get mirrored at verify time —
-- catch them up once so the Income Hub's "Verified Advance" card/list reflect the same total
-- Work Log already shows, instead of only counting advances verified from now on.
INSERT INTO public.income (date, description, amount, source, note, business_name, work_entry_id, added_by)
SELECT
    we.date,
    'Advance payment — Order ' || COALESCE(we.invoice_no, '#' || we.sl::text),
    we.advance,
    'Advance',
    CASE WHEN we.payment_gateway IS NOT NULL THEN 'Paid via ' || we.payment_gateway ELSE NULL END,
    we.business_name,
    we.id,
    we.verified_by
FROM public.work_entries we
WHERE we.advance_verified = true
  AND we.advance IS NOT NULL
  AND we.advance > 0
  AND NOT EXISTS (SELECT 1 FROM public.income i WHERE i.work_entry_id = we.id);
