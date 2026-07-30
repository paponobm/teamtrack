-- Advance Payment Verification: admin/manager can verify a work entry's advance payment.
-- Reuses the existing work_entries.advance column as the "advance amount" (no duplicate
-- advanceAmount column) and adds the verification state alongside it.
ALTER TABLE work_entries ADD COLUMN IF NOT EXISTS advance_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE work_entries ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE work_entries ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_work_entries_advance_verified ON work_entries(advance_verified);
