-- Optional "Basic Salary Starting Month" (Members → Edit Member → Payroll tab). When set,
-- an employee's Basic Salary (and any Salary Increment on top of it) only applies to salary
-- sheets for that calendar month and every month after — sheets for earlier months show ৳0
-- Basic Salary for this employee instead. Left NULL (the default), behavior is unchanged:
-- Basic Salary applies to every month, same as before this column existed.
ALTER TABLE public.employees
    ADD COLUMN IF NOT EXISTS basic_salary_effective_month VARCHAR(7);
