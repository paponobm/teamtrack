-- Work Comparison feature: admin evaluates an employee's submitted daily work reports
-- against their assigned-task points for a period, and awards earned points.
CREATE TABLE IF NOT EXISTS public.work_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_assigned_points INT NOT NULL DEFAULT 0,
    total_earned_points INT NOT NULL DEFAULT 0,
    note TEXT,
    evaluated_by UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    evaluated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.work_evaluation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_id UUID NOT NULL REFERENCES public.work_evaluations(id) ON DELETE CASCADE,
    work_report_id UUID NOT NULL REFERENCES public.work_reports(id) ON DELETE CASCADE,
    points INT NOT NULL DEFAULT 0 CHECK (points >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_evaluations_employee ON public.work_evaluations(employee_id);
CREATE INDEX IF NOT EXISTS idx_work_evaluations_period ON public.work_evaluations(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_work_evaluation_items_evaluation ON public.work_evaluation_items(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_work_evaluation_items_report ON public.work_evaluation_items(work_report_id);

ALTER TABLE public.work_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_evaluation_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read work_evaluations"
    ON public.work_evaluations FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can manage work_evaluations"
    ON public.work_evaluations FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Authenticated users can read work_evaluation_items"
    ON public.work_evaluation_items FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can manage work_evaluation_items"
    ON public.work_evaluation_items FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
