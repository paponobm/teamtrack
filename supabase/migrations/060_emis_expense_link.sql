-- Links each EMI to an auto-created, kept-in-sync Expense row (category "Employee Loan") so
-- the Finance Hub's Total Expenses/Net Balance reflect the loan principal disbursed to
-- employees — same pattern as 052_advances_expense_link.sql for Advance. Unlike Advance,
-- EMI has no payment_status of its own (Paid/Due is derived live from Salary Sheet installment
-- payments, see getEmiPaidSummaries in src/lib/emis.ts), so the linked expense's status is
-- simply fixed at 'pending' (the loan is outstanding) rather than kept in sync with repayment.
ALTER TABLE public.emis
    ADD COLUMN expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL;
