-- EMI (installment loan): a separate deduction type from Advance and Product Buy, combined
-- with Advance in the Finance Hub UI ("Advance & EMI" tab) but tracked in its own table since
-- its shape is fundamentally different (spans a term of months, carries interest).
-- monthly_installment is computed once at creation (flat interest, split evenly across the
-- term: (amount * (1 + interest_rate/100)) / term_months) and stored, so a later edit to
-- amount/rate/term recomputes it explicitly rather than silently drifting.
CREATE TABLE IF NOT EXISTS public.emis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    term_months INTEGER NOT NULL CHECK (term_months IN (3, 6)),
    start_date DATE NOT NULL,
    interest_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
    monthly_installment NUMERIC(10,2) NOT NULL,
    created_by UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emis_employee ON public.emis(employee_id);
CREATE INDEX IF NOT EXISTS idx_emis_start_date ON public.emis(start_date);

CREATE TRIGGER handle_emis_updated_at BEFORE UPDATE ON public.emis
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Admin+ (level <= 3), same tier as advances/product_buys.
ALTER TABLE public.emis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage emis" ON public.emis
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
