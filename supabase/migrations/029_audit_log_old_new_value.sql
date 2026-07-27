-- The activity-log feature (Problem Box, Work Log, Tasks, Attendance) records the
-- before/after of each change in audit_log.old_value / audit_log.new_value. Those columns
-- were never added to the table, so every such audit insert was failing silently and the
-- activity logs showed nothing. Add the columns (additive, non-destructive).

ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS old_value text;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS new_value text;
