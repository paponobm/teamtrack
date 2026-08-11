-- Payroll Management: one salary_sheets row per calendar month, one salary_entries row
-- per (sheet, employee). Attendance/leave/fine numbers are never stored here — they're
-- always computed live from the existing `attendance` and `fines` tables at read time,
-- so payroll can never drift out of sync with those systems (per the "reuse existing
-- attendance/fine logic, don't duplicate it" requirement).
CREATE TABLE IF NOT EXISTS public.salary_sheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month TEXT NOT NULL UNIQUE, -- 'YYYY-MM'
    created_by UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.salary_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salary_sheet_id UUID NOT NULL REFERENCES public.salary_sheets(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    basic_salary NUMERIC(10,2) NOT NULL DEFAULT 0,
    bonus NUMERIC(10,2) NOT NULL DEFAULT 0,
    other_addition NUMERIC(10,2) NOT NULL DEFAULT 0,
    advance NUMERIC(10,2) NOT NULL DEFAULT 0,
    loan NUMERIC(10,2) NOT NULL DEFAULT 0,
    other_deduction NUMERIC(10,2) NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'Unpaid' CHECK (payment_status IN ('Paid', 'Unpaid')),
    updated_by UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(salary_sheet_id, employee_id) -- one salary entry per employee per sheet/month
);

CREATE INDEX IF NOT EXISTS idx_salary_entries_sheet ON public.salary_entries(salary_sheet_id);
CREATE INDEX IF NOT EXISTS idx_salary_entries_employee ON public.salary_entries(employee_id);

CREATE TRIGGER handle_salary_entries_updated_at BEFORE UPDATE ON public.salary_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Salary data is sensitive — unlike most modules in this app, this is Super Admin/Owner
-- only end to end (view, create, edit), enforced server-side via requireAuth(2) in the
-- API routes; RLS mirrors the same rule as defense-in-depth.
ALTER TABLE public.salary_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super Admins manage salary_sheets" ON public.salary_sheets
    FOR ALL TO authenticated
    USING (
        auth.uid() IN (
            SELECT e.user_id FROM public.employees e
            JOIN public.roles r ON e.role_id = r.id
            WHERE r.level <= 2
        )
    )
    WITH CHECK (
        auth.uid() IN (
            SELECT e.user_id FROM public.employees e
            JOIN public.roles r ON e.role_id = r.id
            WHERE r.level <= 2
        )
    );

CREATE POLICY "Super Admins manage salary_entries" ON public.salary_entries
    FOR ALL TO authenticated
    USING (
        auth.uid() IN (
            SELECT e.user_id FROM public.employees e
            JOIN public.roles r ON e.role_id = r.id
            WHERE r.level <= 2
        )
    )
    WITH CHECK (
        auth.uid() IN (
            SELECT e.user_id FROM public.employees e
            JOIN public.roles r ON e.role_id = r.id
            WHERE r.level <= 2
        )
    );
