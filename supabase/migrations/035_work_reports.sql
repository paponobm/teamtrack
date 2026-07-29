-- Daily Work Report feature: employees log per-project work updates; admins review across everyone.
CREATE TABLE IF NOT EXISTS public.work_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    project TEXT NOT NULL,
    description TEXT,
    hours NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK (hours >= 0),
    progress INT NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('completed', 'in_progress', 'pending')),
    attachment_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_reports_employee ON public.work_reports(employee_id);
CREATE INDEX IF NOT EXISTS idx_work_reports_date ON public.work_reports(date);
CREATE INDEX IF NOT EXISTS idx_work_reports_status ON public.work_reports(status);

ALTER TABLE public.work_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read work_reports"
    ON public.work_reports FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can manage work_reports"
    ON public.work_reports FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
