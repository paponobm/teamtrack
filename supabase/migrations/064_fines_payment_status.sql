-- Fines gain a payment_status, separate from the existing Active/Appealed/Waived status —
-- whether the fine amount has been recovered from the employee's salary (or otherwise settled),
-- same Paid/Unpaid pattern already used by advances/product_buys/salary_entries. Independent of
-- status: a fine can be Active+Unpaid, Active+Paid, Appealed+Unpaid, etc. Points are deducted
-- immediately at issue time regardless of payment_status (see POST /api/fines) — this only
-- tracks recovery, it doesn't gate the point deduction itself.
ALTER TABLE public.fines
    ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'Unpaid' CHECK (payment_status IN ('Paid', 'Unpaid'));
