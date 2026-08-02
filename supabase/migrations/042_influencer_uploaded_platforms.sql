-- The Influencers CRM card shows which platforms an influencer uploads content to.
-- Rather than deriving that from a full page/profile URL per platform (too much
-- friction on the quick "Add Influencer" form), it's now a simple multi-select set
-- of platform keys ('facebook' | 'whatsapp' | 'instagram' | 'tiktok' | 'youtube').
ALTER TABLE public.influencers ADD COLUMN IF NOT EXISTS uploaded_platforms TEXT[] NOT NULL DEFAULT '{}';
