-- Richer payment tracking for the "Add PR Entry" form: Payment Status gains an
-- "Advance Paid" state (between Unpaid and Fully Paid) with actual amounts, instead of
-- being a plain 3-way label. Purely additive — pr_management.payment_status itself is
-- untouched (still a free-text column), so PR Management's own table/inline dropdowns
-- keep working exactly as before for every existing row; these new columns are only
-- populated by the new form and simply stay null for older entries.
ALTER TABLE public.pr_management ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10,2);
ALTER TABLE public.pr_management ADD COLUMN IF NOT EXISTS advance_amount NUMERIC(10,2);
ALTER TABLE public.pr_management ADD COLUMN IF NOT EXISTS due_amount NUMERIC(10,2);
ALTER TABLE public.pr_management ADD COLUMN IF NOT EXISTS payment_method TEXT;
