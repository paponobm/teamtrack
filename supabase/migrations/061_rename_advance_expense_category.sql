-- Renames the "Employee Advance" expense category to "Salary Advance" (see
-- ADVANCE_EXPENSE_CATEGORY in src/lib/advances.ts) for every already-created linked expense,
-- so existing Finance Hub records match the new label, not just advances created from now on.
UPDATE public.expenses SET category = 'Salary Advance' WHERE category = 'Employee Advance';
