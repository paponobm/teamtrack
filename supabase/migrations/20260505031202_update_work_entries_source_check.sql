ALTER TABLE work_entries DROP CONSTRAINT IF EXISTS work_entries_source_check;
ALTER TABLE work_entries ADD CONSTRAINT work_entries_source_check CHECK (source IN ('facebook', 'whatsapp', 'web', 'instagram', 'tiktok', 'direct', 'other'));
