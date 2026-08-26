-- Renames the 'Advance' income source (verified Work Log order advances, see
-- POST /api/work-log/[id]/verify-advance and migration 067_income_work_entry_link.sql) to
-- 'Order Advance' — 'Advance' alone was ambiguous next to Finance Hub's own separate "Salary
-- Advance" concept. Data-only correction; work_entry_id linkage is untouched.
UPDATE public.income
SET source = 'Order Advance'
WHERE source = 'Advance';
