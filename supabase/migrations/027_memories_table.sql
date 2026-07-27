-- Migration: 027_memories_table.sql
-- Description: Create the memories table

CREATE TABLE IF NOT EXISTS public.memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    memory_date DATE NOT NULL DEFAULT CURRENT_DATE,
    images JSONB DEFAULT '[]'::jsonb,
    created_by UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "memories_select_policy" ON public.memories;
CREATE POLICY "memories_select_policy" ON public.memories FOR SELECT USING (true);

DROP POLICY IF EXISTS "memories_insert_policy" ON public.memories;
CREATE POLICY "memories_insert_policy" ON public.memories FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "memories_delete_policy" ON public.memories;
CREATE POLICY "memories_delete_policy" ON public.memories FOR DELETE USING (true);
