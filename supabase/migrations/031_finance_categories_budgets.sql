-- finance_categories table
CREATE TABLE IF NOT EXISTS public.finance_categories (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    parent_id UUID REFERENCES public.finance_categories(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.finance_categories ENABLE ROW LEVEL SECURITY;

-- Admins can do anything
CREATE POLICY "Admins can manage finance_categories" 
    ON public.finance_categories FOR ALL 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM public.employees 
            WHERE employees.id = auth.uid() 
            AND employees."roleLevel" <= 3
        )
    );

-- Everyone can read
CREATE POLICY "Everyone can read finance_categories" 
    ON public.finance_categories FOR SELECT 
    TO authenticated 
    USING (true);


-- finance_budgets table
CREATE TABLE IF NOT EXISTS public.finance_budgets (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    category_id UUID NOT NULL REFERENCES public.finance_categories(id) ON DELETE CASCADE,
    period TEXT NOT NULL, -- e.g., '2026-07'
    amount NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(category_id, period)
);

-- Enable RLS
ALTER TABLE public.finance_budgets ENABLE ROW LEVEL SECURITY;

-- Admins can do anything
CREATE POLICY "Admins can manage finance_budgets" 
    ON public.finance_budgets FOR ALL 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM public.employees 
            WHERE employees.id = auth.uid() 
            AND employees."roleLevel" <= 3
        )
    );

-- Everyone can read
CREATE POLICY "Everyone can read finance_budgets" 
    ON public.finance_budgets FOR SELECT 
    TO authenticated 
    USING (true);

-- Insert default categories to bootstrap
INSERT INTO public.finance_categories (name, type) VALUES
    ('Office Rent', 'expense'),
    ('Electricity Bill', 'expense'),
    ('Internet Bill', 'expense'),
    ('Telephone Bills', 'expense'),
    ('Employee Snacks Bill', 'expense'),
    ('Office Supplies', 'expense'),
    ('Product Purchase', 'expense'),
    ('Delivery Charges', 'expense'),
    ('Travel and Transportation', 'expense'),
    ('Marketing', 'expense'),
    ('Advertising', 'expense'),
    ('Maintenance', 'expense'),
    ('Salaries', 'expense'),
    ('Bonus & Commission', 'expense'),
    ('Taxes', 'expense'),
    ('Development', 'expense'),
    ('Subscriptions', 'expense'),
    ('Donations', 'expense'),
    ('Family', 'expense'),
    ('Personal', 'expense'),
    ('Miscellaneous', 'expense'),
    ('Sales', 'income'),
    ('Investment', 'income'),
    ('Other', 'income')
ON CONFLICT DO NOTHING;
