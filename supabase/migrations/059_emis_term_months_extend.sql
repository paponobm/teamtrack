-- Extends the EMI term_months options from (3, 6) to also allow 12 and 24 months, matching
-- the Add Advance/EMI form's Type dropdown (src/components/finance/AdvanceManager.tsx).
ALTER TABLE public.emis DROP CONSTRAINT IF EXISTS emis_term_months_check;
ALTER TABLE public.emis ADD CONSTRAINT emis_term_months_check CHECK (term_months IN (3, 6, 12, 24));
