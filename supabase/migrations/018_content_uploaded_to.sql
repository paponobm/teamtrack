-- Migration to add social platform tracking for content
ALTER TABLE public.content_batches
ADD COLUMN IF NOT EXISTS uploaded_to TEXT[] DEFAULT '{}'::TEXT[];
