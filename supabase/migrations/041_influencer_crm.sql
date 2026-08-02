-- Extends the `influencers` table (created in 034_influencer_profiles.sql) with the
-- fields needed for the Influencers CRM tab: profile photo, address, active/inactive
-- status, extra social links (page_url/phone already covered Facebook + WhatsApp),
-- a 5-criteria rating breakdown that the overall `rating` column is auto-averaged from,
-- and an updated_at trigger (mirrors pr_management's, reusing the same trigger function).
ALTER TABLE public.influencers ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE public.influencers ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.influencers ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Active';
ALTER TABLE public.influencers ADD COLUMN IF NOT EXISTS instagram_url TEXT;
ALTER TABLE public.influencers ADD COLUMN IF NOT EXISTS tiktok_url TEXT;
ALTER TABLE public.influencers ADD COLUMN IF NOT EXISTS youtube_url TEXT;
ALTER TABLE public.influencers ADD COLUMN IF NOT EXISTS rating_responsiveness INT;
ALTER TABLE public.influencers ADD COLUMN IF NOT EXISTS rating_quality INT;
ALTER TABLE public.influencers ADD COLUMN IF NOT EXISTS rating_professionalism INT;
ALTER TABLE public.influencers ADD COLUMN IF NOT EXISTS rating_engagement INT;
ALTER TABLE public.influencers ADD COLUMN IF NOT EXISTS rating_reliability INT;
ALTER TABLE public.influencers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DROP TRIGGER IF EXISTS handle_influencers_updated_at ON public.influencers;
CREATE TRIGGER handle_influencers_updated_at BEFORE UPDATE ON public.influencers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- The original 034 migration left influencers wide open (`FOR ALL USING (auth.role() =
-- 'authenticated')`), so any authenticated user could edit/delete any profile directly
-- via the Supabase client. Replace it with per-action policies: SELECT/INSERT stay open
-- (needed for the pr-management auto-link-on-create flow, which runs as the submitting
-- member, not an admin), UPDATE/DELETE are restricted to Admin/Owner/Super Admin,
-- matching pr_management's existing delete policy convention.
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.influencers;

CREATE POLICY "Enable read access for all authenticated users" ON public.influencers
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert access for all authenticated users" ON public.influencers
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update access for admins" ON public.influencers
    FOR UPDATE TO authenticated
    USING (
        auth.uid() IN (
            SELECT e.user_id FROM public.employees e
            JOIN public.roles r ON e.role_id = r.id
            WHERE r.name IN ('Admin', 'Owner', 'Super Admin')
        )
    )
    WITH CHECK (
        auth.uid() IN (
            SELECT e.user_id FROM public.employees e
            JOIN public.roles r ON e.role_id = r.id
            WHERE r.name IN ('Admin', 'Owner', 'Super Admin')
        )
    );

CREATE POLICY "Enable delete access for admins" ON public.influencers
    FOR DELETE TO authenticated
    USING (
        auth.uid() IN (
            SELECT e.user_id FROM public.employees e
            JOIN public.roles r ON e.role_id = r.id
            WHERE r.name IN ('Admin', 'Owner', 'Super Admin')
        )
    );
