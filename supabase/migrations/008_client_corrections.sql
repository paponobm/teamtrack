-- ============================================
-- 008 CLIENT CORRECTIONS MIGRATION
-- 22 corrections: new tables, columns, constraints
-- ============================================

-- 1. Ideas: reference links field (#22)
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS reference_links TEXT;

-- 2. Courier issues: logistics field (#18)
ALTER TABLE courier_issues ADD COLUMN IF NOT EXISTS logistics TEXT;

-- 3. Problems: resolution_note field (#11)
ALTER TABLE problems ADD COLUMN IF NOT EXISTS resolution_note TEXT;

-- 4. Expand courier_issues problem_status to include more options
ALTER TABLE courier_issues DROP CONSTRAINT IF EXISTS courier_issues_problem_status_check;
-- No constraint needed — we allow flexible status values

-- 5. Global Source Options table (#18 - global sources)
CREATE TABLE IF NOT EXISTS source_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO source_options (name, slug, sort_order) VALUES
  ('Facebook', 'facebook', 1),
  ('WhatsApp', 'whatsapp', 2),
  ('Website', 'website', 3),
  ('Instagram', 'instagram', 4),
  ('TikTok', 'tiktok', 5),
  ('Direct', 'direct', 6),
  ('Other', 'other', 7)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE source_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can read source_options" ON source_options
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage source_options" ON source_options
  FOR ALL TO authenticated USING (true);

-- 6. Employee Access Records table (#12 - permission tracking)
CREATE TABLE IF NOT EXISTS employee_access_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  platform_name TEXT NOT NULL,
  role_description TEXT,
  granted_by UUID REFERENCES employees(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE employee_access_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can read employee_access_records" ON employee_access_records
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage employee_access_records" ON employee_access_records
  FOR ALL TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_employee_access_employee ON employee_access_records(employee_id);

-- 7. Memories table (#20)
CREATE TABLE IF NOT EXISTS memories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT,
  description TEXT,
  image_url TEXT NOT NULL,
  uploaded_by UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can read memories" ON memories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert memories" ON memories
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can delete memories" ON memories
  FOR DELETE TO authenticated USING (true);

-- 8. Tasks table (#21)
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled', 'rejected')),
  created_by UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  UNIQUE(task_id, employee_id)
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read tasks" ON tasks
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage tasks" ON tasks
  FOR ALL TO authenticated USING (true);
CREATE POLICY "Auth users can read task_assignments" ON task_assignments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage task_assignments" ON task_assignments
  FOR ALL TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_task_assignments_employee ON task_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_task ON task_assignments(task_id);

-- 9. Leave records table (#16)
CREATE TABLE IF NOT EXISTS leave_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, date)
);

ALTER TABLE leave_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can read leave_records" ON leave_records
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can manage leave_records" ON leave_records
  FOR ALL TO authenticated USING (true);

-- 10. Expenses: add payment_gateway column if not exists
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_gateway TEXT;
