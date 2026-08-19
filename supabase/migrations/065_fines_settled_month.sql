-- Tracks which month a fine was actually settled (recovered) in, so getFineTotalsForMonth can
-- tell "still outstanding" apart from "already paid off" on a per-month basis instead of a
-- single point-in-time flag. Without this, the moment a fine's payment_status flips to 'Paid'
-- it vanishes from EVERY month's deduction total — including the very month it was just
-- recovered in, which silently corrupted that month's Payable Salary and linked Expense amount.
ALTER TABLE public.fines
    ADD COLUMN settled_month TEXT NULL;
