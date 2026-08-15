-- Per-employee payroll defaults, set once by a Super Admin on the employee's profile
-- (Members → Edit Member → Payroll / Festival Bonus tabs). These are distinct from
-- salary_entries' own basic_salary/transportation_bill/snacks_bill/festival_bonus columns:
-- the salary_entries columns are the frozen, actual value for a specific month (snapshotted
-- at salary-sheet-creation time from these defaults); these employees columns are just the
-- "what to pre-fill" source, so changing an employee's base salary here never rewrites past
-- months' already-created salary sheets.
ALTER TABLE public.employees
    ADD COLUMN IF NOT EXISTS payroll_basic_salary NUMERIC(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS payroll_transportation_bill NUMERIC(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS payroll_snacks_bill NUMERIC(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS festival_bonus_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS festival_bonus_months INTEGER[] NOT NULL DEFAULT '{}';
