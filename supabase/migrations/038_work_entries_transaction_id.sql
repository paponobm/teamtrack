-- Same pattern as 006_corrections.sql's work_entries.payment_gateway/business_name:
-- capture the payment gateway's transaction ID for a work entry.
ALTER TABLE work_entries ADD COLUMN IF NOT EXISTS transaction_id TEXT;
