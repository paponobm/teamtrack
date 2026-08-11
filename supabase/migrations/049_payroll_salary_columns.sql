-- Reshapes salary_entries' generic addition/bonus fields into the specific fields the
-- Salary Sheet table actually displays, and adds payment method/date tracking (Paid/Unpaid
-- only, no bank integration — payment_method just records how it was settled).
ALTER TABLE public.salary_entries RENAME COLUMN other_addition TO extra_duty;

ALTER TABLE public.salary_entries
    ADD COLUMN performance_bonus NUMERIC(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN festival_bonus NUMERIC(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN payment_method TEXT CHECK (payment_method IN ('bKash', 'Rocket', 'Nagad', 'Bank', 'Cash')),
    ADD COLUMN payment_date DATE;

ALTER TABLE public.salary_entries DROP COLUMN bonus;
