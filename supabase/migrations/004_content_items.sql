-- ============================================
-- CONTENT ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS content_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    type TEXT CHECK (type IN ('post', 'video', 'story', 'reel', 'blog', 'other')) DEFAULT 'post',
    platform TEXT CHECK (platform IN ('facebook', 'instagram', 'youtube', 'tiktok', 'website', 'other')) DEFAULT 'facebook',
    status TEXT CHECK (status IN ('draft', 'review', 'approved', 'published', 'rejected')) DEFAULT 'draft',
    assigned_to UUID REFERENCES employees(id) ON DELETE SET NULL,
    due_date DATE,
    content_url TEXT,
    description TEXT,
    notes TEXT,
    created_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;

-- Allow authenticated read
CREATE POLICY "Authenticated users can read content_items"
    ON content_items FOR SELECT
    TO authenticated
    USING (true);

-- Allow authenticated insert/update/delete
CREATE POLICY "Authenticated users can manage content_items"
    ON content_items FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Index
CREATE INDEX idx_content_items_status ON content_items(status);
CREATE INDEX idx_content_items_assigned ON content_items(assigned_to);
