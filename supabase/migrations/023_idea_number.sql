-- Add unique serial number to ideas table
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS idea_no SERIAL;
