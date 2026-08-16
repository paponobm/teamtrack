-- Provident Fund: an installment-based employee contribution/return, architecturally
-- identical to EMI (see 055_emis.sql) — flat interest over a fixed duration, no linked
-- Expense record (it's a payroll deduction, not an out-of-pocket expense event). Unlike EMI,
-- Paid/Due is derived on read from whether each covered month's salary_entries row was
-- marked payment_status = 'Paid' (see src/lib/providentFunds.ts) rather than a separate
-- ledger table — reusing the Salary Sheet's existing Paid mechanism instead of duplicating it.
-- duration_months intentionally has no restrictive CHECK beyond > 0, so the duration dropdown
-- (3/6/12/18/24 months) can be extended later without a migration.
CREATE TABLE IF NOT EXISTS public.provident_funds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    principal_amount NUMERIC(10,2) NOT NULL CHECK (principal_amount > 0),
    duration_months INTEGER NOT NULL CHECK (duration_months > 0),
    interest_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
    monthly_installment NUMERIC(10,2) NOT NULL,
    start_date DATE NOT NULL,
    note TEXT,
    created_by UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provident_funds_employee ON public.provident_funds(employee_id);
CREATE INDEX IF NOT EXISTS idx_provident_funds_start_date ON public.provident_funds(start_date);

CREATE TRIGGER handle_provident_funds_updated_at BEFORE UPDATE ON public.provident_funds
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.provident_funds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage provident funds" ON public.provident_funds FOR ALL TO authenticated
    USING (auth.uid() IN (SELECT e.user_id FROM public.employees e JOIN public.roles r ON e.role_id = r.id WHERE r.level <= 3))
    WITH CHECK (auth.uid() IN (SELECT e.user_id FROM public.employees e JOIN public.roles r ON e.role_id = r.id WHERE r.level <= 3));
