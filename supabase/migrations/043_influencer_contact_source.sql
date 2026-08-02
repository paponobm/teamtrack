-- Generic contact channel for an influencer (source platform + the link/number for it),
-- separate from `uploaded_platforms` (which platforms they upload video content to).
ALTER TABLE public.influencers ADD COLUMN IF NOT EXISTS contact_source TEXT;
ALTER TABLE public.influencers ADD COLUMN IF NOT EXISTS contact_value TEXT;
