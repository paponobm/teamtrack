-- ============================================
-- 014: LEAVE RECORDS TABLE
-- Creates the leave_records table that was
-- referenced in code but never created.
-- ============================================

CREATE TABLE IF NOT EXISTS leave_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    leave_date DATE NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    approved_by UUID REFERENCES employees(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(employee_id, leave_date)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_leave_records_employee_date ON leave_records(employee_id, leave_date);

-- RLS
ALTER TABLE leave_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read leave_records" ON leave_records
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage leave_records" ON leave_records
    FOR ALL TO authenticated USING (true);
