-- Add category column to problems table
ALTER TABLE problems ADD COLUMN IF NOT EXISTS category TEXT;
