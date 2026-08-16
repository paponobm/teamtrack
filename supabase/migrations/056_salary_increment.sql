-- Salary increment, set once by a Super Admin on the employee's profile (Members → Edit
-- Member → Payroll tab). This is an amount added on top of payroll_basic_salary starting
-- from a given calendar month (inclusive) and every month after — not a recurring bonus like
-- Festival Bonus, and not itself the new Basic Salary; a raise on top of it. Applied the same
-- way payroll_basic_salary is: read when a month's salary sheet is first created and frozen
-- into that sheet's salary_entries.basic_salary, so changing it later never rewrites past
-- months' already-created sheets.
ALTER TABLE public.employees
    ADD COLUMN IF NOT EXISTS salary_increment_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS salary_increment_effective_month VARCHAR(7);
