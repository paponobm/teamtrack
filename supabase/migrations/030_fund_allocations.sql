-- Migration 030: Fund system (V3 #18/#19)
-- Super Admins allocate funds to Admins (one or many allocations over time). Admins log
-- expenses; when an expense is APPROVED (payment_status='paid') it is deducted from the
-- holder's fund. Remaining = SUM(allocations) - SUM(paid expenses by that employee).
-- Allocations are stored as an append-only ledger so the history is transparent.

CREATE TABLE IF NOT EXISTS public.fund_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,   -- the fund holder (admin)
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    note TEXT,
    allocated_by UUID REFERENCES public.employees(id) ON DELETE SET NULL,          -- the super admin who allocated
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fund_allocations_employee ON public.fund_allocations(employee_id);
CREATE INDEX IF NOT EXISTS idx_fund_allocations_created_at ON public.fund_allocations(created_at DESC);

-- RLS enabled with permissive policies: all real authorization is enforced in the API routes
-- via the service-role client (consistent with the rest of the schema, e.g. memories).
ALTER TABLE public.fund_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fund_allocations_select_policy" ON public.fund_allocations;
CREATE POLICY "fund_allocations_select_policy" ON public.fund_allocations FOR SELECT USING (true);

DROP POLICY IF EXISTS "fund_allocations_insert_policy" ON public.fund_allocations;
CREATE POLICY "fund_allocations_insert_policy" ON public.fund_allocations FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "fund_allocations_delete_policy" ON public.fund_allocations;
CREATE POLICY "fund_allocations_delete_policy" ON public.fund_allocations FOR DELETE USING (true);
