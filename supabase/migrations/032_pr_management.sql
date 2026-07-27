-- Create pr_management table
CREATE TABLE IF NOT EXISTS public.pr_management (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    send_date DATE NOT NULL DEFAULT CURRENT_DATE,
    customer_name TEXT,
    customer_phone TEXT,
    address TEXT,
    parcel_details TEXT,
    source TEXT,
    delivery_status TEXT DEFAULT 'Product Sent',
    video_status TEXT DEFAULT 'Pending',
    payment_status TEXT DEFAULT 'Unpaid',
    video_link TEXT,
    view_note TEXT,
    ai_comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS policies
ALTER TABLE public.pr_management ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read PR data
CREATE POLICY "Enable read access for all authenticated users" ON public.pr_management
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow all authenticated users to insert PR data
CREATE POLICY "Enable insert access for all authenticated users" ON public.pr_management
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Allow all authenticated users to update PR data
CREATE POLICY "Enable update access for all authenticated users" ON public.pr_management
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Allow admins or creators to delete PR data
CREATE POLICY "Enable delete access for admins or creators" ON public.pr_management
    FOR DELETE
    TO authenticated
    USING (
        auth.uid() IN (
            SELECT e.user_id FROM public.employees e
            JOIN public.roles r ON e.role_id = r.id
            WHERE r.name IN ('Admin', 'Owner', 'Super Admin')
        )
        OR created_by = (SELECT id FROM public.employees WHERE user_id = auth.uid())
    );

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create updated_at trigger
DROP TRIGGER IF EXISTS handle_updated_at ON public.pr_management;
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.pr_management
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
