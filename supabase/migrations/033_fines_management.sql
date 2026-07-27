CREATE TABLE IF NOT EXISTS public.fines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    issued_by UUID NOT NULL REFERENCES public.employees(id) ON DELETE SET NULL,
    amount INTEGER NOT NULL CHECK (amount > 0),
    category TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Appealed', 'Waived')),
    appeal_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies for fines
ALTER TABLE public.fines ENABLE ROW LEVEL SECURITY;

-- Admins and Super Admins can read all fines
CREATE POLICY "Admins and Super Admins can view all fines" 
ON public.fines FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.employees e
        JOIN public.roles r ON e.role_id = r.id
        WHERE e.user_id = auth.uid() AND r.level <= 3
    )
);

-- Members can read their own fines
CREATE POLICY "Members can view their own fines"
ON public.fines FOR SELECT
USING (
    member_id IN (
        SELECT id FROM public.employees WHERE user_id = auth.uid()
    )
);

-- Only Admins/Super Admins can insert fines
CREATE POLICY "Admins can insert fines"
ON public.fines FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.employees e
        JOIN public.roles r ON e.role_id = r.id
        WHERE e.user_id = auth.uid() AND r.level <= 3
    )
);

-- Only Admins/Super Admins can update fines (for waiving)
CREATE POLICY "Admins can update fines"
ON public.fines FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.employees e
        JOIN public.roles r ON e.role_id = r.id
        WHERE e.user_id = auth.uid() AND r.level <= 3
    )
);

-- Members can appeal their own fines (Update appeal_reason and status to Appealed)
CREATE POLICY "Members can appeal fines"
ON public.fines FOR UPDATE
USING (
    member_id IN (
        SELECT id FROM public.employees WHERE user_id = auth.uid()
    )
    AND status = 'Active'
    AND created_at >= NOW() - INTERVAL '3 days'
);
