-- Migration to add social platform tracking for content
-- NOTE: content_batches was previously created out-of-band (not via a tracked
-- migration), so we create it here defensively before altering it.
CREATE TABLE IF NOT EXISTS public.content_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT DEFAULT 'video',
    titles TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    shoot_done BOOLEAN DEFAULT false,
    edit_done BOOLEAN DEFAULT false,
    upload_done BOOLEAN DEFAULT false,
    created_by UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.content_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read content_batches" ON public.content_batches;
CREATE POLICY "Authenticated users can read content_batches"
    ON public.content_batches FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage content_batches" ON public.content_batches;
CREATE POLICY "Authenticated users can manage content_batches"
    ON public.content_batches FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_content_batches_created_by ON public.content_batches(created_by);

ALTER TABLE public.content_batches
ADD COLUMN IF NOT EXISTS uploaded_to TEXT[] DEFAULT '{}'::TEXT[];
