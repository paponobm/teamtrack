-- ============================================
-- NOTICES / NOTICEBOARD
-- ============================================
CREATE TABLE notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT,
  type TEXT CHECK (type IN ('notice', 'meeting', 'announcement', 'other')) DEFAULT 'notice',
  priority TEXT CHECK (priority IN ('normal', 'important', 'urgent')) DEFAULT 'normal',
  is_pinned BOOLEAN DEFAULT false,
  created_by UUID REFERENCES employees(id),
  expires_at DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read notices" ON notices
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage notices" ON notices
  FOR ALL TO authenticated USING (true);

CREATE INDEX idx_notices_created_at ON notices(created_at DESC);
