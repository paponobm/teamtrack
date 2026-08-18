-- Marking a salary entry Paid now also mirrors that payout into Finance Hub as a real Expense
-- (category "Employee Salary", amount = Payable Salary) — same "linked expense" pattern already
-- used by Advance/EMI (see src/lib/advances.ts, src/lib/emis.ts). This column tracks that link
-- so a later edit to a Paid entry's amounts can re-sync the same expense row instead of creating
-- a duplicate.
ALTER TABLE public.salary_entries
    ADD COLUMN expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL;
