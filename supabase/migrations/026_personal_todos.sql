-- Migration 026: Create personal_todos
CREATE TABLE IF NOT EXISTS personal_todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  completed BOOLEAN DEFAULT false,
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Enable
ALTER TABLE personal_todos ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their own personal todos" ON personal_todos
  FOR ALL TO authenticated USING (
    employee_id = (SELECT id FROM employees WHERE user_id = auth.uid() LIMIT 1)
  ) WITH CHECK (
    employee_id = (SELECT id FROM employees WHERE user_id = auth.uid() LIMIT 1)
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_personal_todos_employee ON personal_todos(employee_id);
CREATE INDEX IF NOT EXISTS idx_personal_todos_completed ON personal_todos(completed);
CREATE INDEX IF NOT EXISTS idx_personal_todos_created_at ON personal_todos(created_at DESC);
