-- Add invoice_id to expenses
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS invoice_id TEXT;

-- Income table for tracking income entries
CREATE TABLE IF NOT EXISTS income (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE DEFAULT CURRENT_DATE,
  description TEXT,
  amount DECIMAL(10,2) NOT NULL,
  source TEXT,
  invoice_id TEXT,
  note TEXT,
  business_name TEXT,
  added_by UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE income ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read income" ON income
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert income" ON income
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update income" ON income
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete income" ON income
  FOR DELETE TO authenticated USING (true);
