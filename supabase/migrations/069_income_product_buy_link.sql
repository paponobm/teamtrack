-- Links a mirrored Income row back to the Product Buy it was created from. When a Product Buy
-- deduction is settled through payroll (PUT /api/payroll/salary-entries marking a salary entry
-- Paid), the recovered amount is now mirrored into `income` (source = 'Product Sell') — from
-- the company's side, recovering what it fronted for the product is revenue from having sold
-- it to the employee. Same idempotent "linked record" pattern as work_entry_id (see migration
-- 067_income_work_entry_link.sql for verified Work Log advances). NULL for every other income
-- entry.
ALTER TABLE public.income
    ADD COLUMN IF NOT EXISTS product_buy_id UUID REFERENCES public.product_buys(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_income_product_buy_id ON public.income(product_buy_id) WHERE product_buy_id IS NOT NULL;

-- Backfill: Product Buys already settled (Paid) before this feature existed didn't get
-- mirrored at settlement time — catch them up once so the Income Hub reflects the same
-- recovered amounts the Salary Sheet's own Product Buy column already shows.
INSERT INTO public.income (date, description, amount, source, product_buy_id, added_by)
SELECT
    pb.purchase_date,
    'Product sale — ' || COALESCE(pb.item, 'Product'),
    pb.amount,
    'Product Sell',
    pb.id,
    pb.created_by
FROM public.product_buys pb
WHERE pb.payment_status = 'Paid'
  AND NOT EXISTS (SELECT 1 FROM public.income i WHERE i.product_buy_id = pb.id);
