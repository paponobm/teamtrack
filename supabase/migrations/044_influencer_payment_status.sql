-- Manual payment status set on the influencer profile itself (Paid/Unpaid/Free —
-- same enum values already used by pr_management.payment_status), independent of the
-- card's auto-computed "Paid/Unpaid" badge which is derived from their PR history.
ALTER TABLE public.influencers ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'Unpaid';
