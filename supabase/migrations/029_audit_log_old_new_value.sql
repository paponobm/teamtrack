-- The activity-log feature (Problem Box, Work Log, Tasks, Attendance) records the
-- before/after of each change in audit_log.old_value / audit_log.new_value. Those columns
-- were never added to the table, so every such audit insert was failing silently and the
-- activity logs showed nothing. Add the columns (additive, non-destructive).

-- NOTE: audit_log was previously created out-of-band (not via a tracked migration),
-- so we create it here defensively before altering it. Accessed exclusively via the
-- service-role admin client (see src/lib/audit.ts), so RLS is enabled with no policies
-- (default deny) rather than open authenticated access.
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    module TEXT,
    target_id UUID,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_audit_log_module ON public.audit_log(module);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON public.audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_target ON public.audit_log(target_id);

ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS old_value text;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS new_value text;
