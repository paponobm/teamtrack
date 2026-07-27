-- Add missing columns to courier_issues table
ALTER TABLE courier_issues 
ADD COLUMN IF NOT EXISTS logistics TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS payment_gateway TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS business_name TEXT DEFAULT NULL;
