-- Two more per-employee monthly earning components on the salary sheet: transportation and
-- snacks bill reimbursements. Same treatment as extra_duty — manually entered, added into
-- Net Payable, zero by default.
ALTER TABLE public.salary_entries
    ADD COLUMN transportation_bill NUMERIC(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN snacks_bill NUMERIC(10,2) NOT NULL DEFAULT 0;
