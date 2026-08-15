-- Product Buy: a distinct deduction type from Advance — money the company fronted for a
-- product an employee purchased/received on credit, recoverable via payroll. Deliberately a
-- separate table from `advances` (not a relabeling of it) so the two have independent
-- records, calculations, and Salary Sheet columns, per explicit product decision.
CREATE TABLE IF NOT EXISTS public.product_buys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    purchase_date DATE NOT NULL,
    item TEXT,
    note TEXT,
    payment_status TEXT NOT NULL DEFAULT 'Unpaid' CHECK (payment_status IN ('Paid', 'Unpaid')),
    expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL,
    created_by UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_buys_employee ON public.product_buys(employee_id);
CREATE INDEX IF NOT EXISTS idx_product_buys_date ON public.product_buys(purchase_date);

CREATE TRIGGER handle_product_buys_updated_at BEFORE UPDATE ON public.product_buys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Admin+ (level <= 3), same tier as advances.
ALTER TABLE public.product_buys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage product_buys" ON public.product_buys
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
