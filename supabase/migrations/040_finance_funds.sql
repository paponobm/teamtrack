-- finance_funds and expenses.fund_id are both already used throughout the app
-- (src/app/api/finance/funds/route.ts, the Finance Hub "Funds" tab, and the Fund picker
-- on the New Expense form), but neither was ever created via a tracked migration —
-- same out-of-band-creation pattern as content_batches/audit_log/tasks.task_no earlier.
CREATE TABLE IF NOT EXISTS public.finance_funds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
    category TEXT DEFAULT 'Uncategorized',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.finance_funds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read finance_funds"
    ON public.finance_funds FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can manage finance_funds"
    ON public.finance_funds FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS fund_id UUID REFERENCES public.finance_funds(id) ON DELETE SET NULL;
