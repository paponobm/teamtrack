-- ============================================
-- 17. ATTENDANCE BREAKS
-- ============================================

CREATE TABLE IF NOT EXISTS attendance_breaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attendance_id UUID REFERENCES attendance(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_attendance_breaks_attendance_id ON attendance_breaks(attendance_id);

-- RLS
ALTER TABLE attendance_breaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read attendance breaks" ON attendance_breaks
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage attendance breaks" ON attendance_breaks
  FOR ALL TO authenticated USING (true);
