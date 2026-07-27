-- ============================================
-- ENHANCEMENTS MIGRATION
-- Work Log, Problems, Members improvements
-- ============================================

-- 1. Work Entries: customer_name field
ALTER TABLE work_entries ADD COLUMN IF NOT EXISTS customer_name TEXT;

-- 2. Employees: new profile fields
ALTER TABLE employees ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female', 'other'));
ALTER TABLE employees ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS cv_url TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS duty_start_time TIME;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS duty_end_time TIME;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS total_points INT DEFAULT 0;

-- 3. Activity Log table (shared across modules)
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES employees(id),
  module TEXT NOT NULL,            -- 'work_log', 'problems', 'members'
  action TEXT NOT NULL,            -- 'status_change', 'pick', 'unpick', 'solve', etc.
  target_id UUID NOT NULL,
  old_value TEXT,
  new_value TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for activity_log
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read activity_log" ON activity_log
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Auth users can insert activity_log" ON activity_log
  FOR INSERT TO authenticated WITH CHECK (true);

-- Indexes for activity_log
CREATE INDEX IF NOT EXISTS idx_activity_log_module_target ON activity_log(module, target_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_actor ON activity_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at DESC);

-- Index for birthday queries
CREATE INDEX IF NOT EXISTS idx_employees_dob ON employees(date_of_birth);
