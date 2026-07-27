-- ============================================
-- NOTICE READ RECEIPTS
-- ============================================
CREATE TABLE IF NOT EXISTS notice_reads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  notice_id UUID REFERENCES notices(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(notice_id, employee_id)
);

ALTER TABLE notice_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_notice_reads" ON notice_reads
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_manage_notice_reads" ON notice_reads
  FOR ALL TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_notice_reads_notice ON notice_reads(notice_id);
CREATE INDEX IF NOT EXISTS idx_notice_reads_employee ON notice_reads(employee_id);
