-- Optional transaction ID captured alongside a payment method on the Add PR Entry form.
ALTER TABLE public.pr_management ADD COLUMN IF NOT EXISTS transaction_id TEXT;
