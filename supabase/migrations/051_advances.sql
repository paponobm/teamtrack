-- Advance Management: standalone per-employee cash-advance records. The Payroll Salary
-- Sheet's ADVANCE column no longer stores its own number — it's computed live by summing
-- this table for the selected month (same "reuse, don't duplicate" pattern already used for
-- attendance/fines), so the two modules can never disagree.
CREATE TABLE IF NOT EXISTS public.advances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    advance_date DATE NOT NULL,
    note TEXT,
    payment_status TEXT NOT NULL DEFAULT 'Unpaid' CHECK (payment_status IN ('Paid', 'Unpaid')),
    created_by UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_advances_employee ON public.advances(employee_id);
CREATE INDEX IF NOT EXISTS idx_advances_date ON public.advances(advance_date);

CREATE TRIGGER handle_advances_updated_at BEFORE UPDATE ON public.advances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Admin+ (level <= 3) can manage advances, matching the sidebar placement alongside Expenses
-- rather than Payroll's Super-Admin-only tier.
ALTER TABLE public.advances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage advances" ON public.advances
    FOR ALL TO authenticated
    USING (
        auth.uid() IN (
            SELECT e.user_id FROM public.employees e
            JOIN public.roles r ON e.role_id = r.id
            WHERE r.level <= 3
        )
    )
    WITH CHECK (
        auth.uid() IN (
            SELECT e.user_id FROM public.employees e
            JOIN public.roles r ON e.role_id = r.id
            WHERE r.level <= 3
        )
    );
