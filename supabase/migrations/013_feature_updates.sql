-- ============================================
-- FEATURE UPDATES MIGRATION
-- Points system, order types, courier fixes
-- ============================================

-- 1. Courier: add business_name column
ALTER TABLE courier_issues ADD COLUMN IF NOT EXISTS business_name TEXT;

-- 2. Point Transactions table (logs every point award)
CREATE TABLE IF NOT EXISTS point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  points INT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('manual', 'order', 'task', 'courier', 'idea', 'problem')),
  source_id UUID,
  category TEXT,
  description TEXT,
  awarded_by UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for point_transactions
ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read point_transactions" ON point_transactions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Auth users can insert point_transactions" ON point_transactions
  FOR INSERT TO authenticated WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_point_transactions_employee ON point_transactions(employee_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_source ON point_transactions(source);
CREATE INDEX IF NOT EXISTS idx_point_transactions_created ON point_transactions(created_at DESC);

-- 3. Expand order_type in work_entries
ALTER TABLE work_entries DROP CONSTRAINT IF EXISTS work_entries_order_type_check;
ALTER TABLE work_entries ADD CONSTRAINT work_entries_order_type_check
  CHECK (order_type IN ('normal', 'suggested', '2000_plus', '3000_plus', '5000_plus', 'incomplete', 'retargeting'));

-- 4. Ideas: add reference_links column if missing
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS reference_links TEXT;

-- 5. Problems: add resolution_note, business_name columns if missing
ALTER TABLE problems ADD COLUMN IF NOT EXISTS resolution_note TEXT;
ALTER TABLE problems ADD COLUMN IF NOT EXISTS business_name TEXT;
