-- The Add Income form (src/app/(dashboard)/expenses/page.tsx) and POST/PATCH /api/income have
-- always sent a "Fund (Deposit To)" fund_id, but 040_finance_funds.sql only ever added fund_id
-- to `expenses` — `income` never got the matching column, so every Add Income submission that
-- reached the database failed with "Could not find the 'fund_id' column of 'income'". Same
-- column shape as expenses.fund_id.
ALTER TABLE public.income ADD COLUMN IF NOT EXISTS fund_id UUID REFERENCES public.finance_funds(id) ON DELETE SET NULL;
