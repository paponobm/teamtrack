-- ============================================
-- 007 ADD PAYMENT GATEWAY TO EXPENSES & REQUISITIONS
-- ============================================

-- 1. expenses: payment_gateway
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_gateway TEXT;

-- 2. requisitions: payment_gateway
ALTER TABLE requisitions ADD COLUMN IF NOT EXISTS payment_gateway TEXT;
