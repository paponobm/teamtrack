-- Links each advance to an auto-created, kept-in-sync Expense row (category "Employee
-- Advance") so the Finance Hub's Total Expenses/Net Balance reflect advances paid out to
-- employees, without maintaining a second parallel financial total.
ALTER TABLE public.advances
    ADD COLUMN expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL;
