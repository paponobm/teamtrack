-- 033_influencer_profiles.sql
-- Create influencers table
CREATE TABLE IF NOT EXISTS influencers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    phone TEXT,
    page_url TEXT,
    follower_count INT DEFAULT 0,
    rating INT DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add influencer_id to pr_management
ALTER TABLE pr_management ADD COLUMN IF NOT EXISTS influencer_id UUID REFERENCES influencers(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE influencers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON influencers;
CREATE POLICY "Enable all for authenticated users" ON influencers FOR ALL USING (auth.role() = 'authenticated');

-- Retroactively populate influencers based on existing pr_management data
DO $$
DECLARE
    rec RECORD;
    inf_id UUID;
BEGIN
    FOR rec IN SELECT * FROM pr_management LOOP
        -- check if an influencer already exists with this phone (if not null) or name
        IF rec.customer_phone IS NOT NULL AND rec.customer_phone != '' THEN
            SELECT id INTO inf_id FROM influencers WHERE phone = rec.customer_phone LIMIT 1;
        ELSE
            SELECT id INTO inf_id FROM influencers WHERE name = rec.customer_name LIMIT 1;
        END IF;
        
        -- If not found, create a new influencer
        IF NOT FOUND THEN
            INSERT INTO influencers (name, phone) 
            VALUES (rec.customer_name, rec.customer_phone)
            RETURNING id INTO inf_id;
        END IF;

        -- Link the PR entry to this influencer
        UPDATE pr_management 
        SET influencer_id = inf_id 
        WHERE id = rec.id;
    END LOOP;
END $$;
