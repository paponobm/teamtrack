-- ============================================
-- 006 CORRECTIONS MIGRATION
-- Payment gateway, business name, expanded statuses
-- ============================================

-- 1. work_entries: payment_gateway and business_name
ALTER TABLE work_entries ADD COLUMN IF NOT EXISTS payment_gateway TEXT;
ALTER TABLE work_entries ADD COLUMN IF NOT EXISTS business_name TEXT;

-- 2. problems: payment_gateway and business_name
ALTER TABLE problems ADD COLUMN IF NOT EXISTS payment_gateway TEXT;
ALTER TABLE problems ADD COLUMN IF NOT EXISTS business_name TEXT;

-- 3. courier_issues: payment_gateway and business_name
ALTER TABLE courier_issues ADD COLUMN IF NOT EXISTS payment_gateway TEXT;
ALTER TABLE courier_issues ADD COLUMN IF NOT EXISTS business_name TEXT;

-- 4. expenses: business_name
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS business_name TEXT;

-- 5. requisitions: business_name
ALTER TABLE requisitions ADD COLUMN IF NOT EXISTS business_name TEXT;

-- 6. Expand work_entries delivery_status constraint to include new statuses
ALTER TABLE work_entries DROP CONSTRAINT IF EXISTS work_entries_delivery_status_check;
ALTER TABLE work_entries ADD CONSTRAINT work_entries_delivery_status_check 
  CHECK (delivery_status IN ('delivered', 'pending', 'returned', 'exchanged', 'refunded', 'partial_refunded', 'cancelled', 'partial'));

-- 7. requisitions: Add purchase_status column if missing
ALTER TABLE requisitions ADD COLUMN IF NOT EXISTS purchase_status TEXT DEFAULT 'pending';
