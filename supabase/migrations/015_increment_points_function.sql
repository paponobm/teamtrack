-- ============================================
-- 015: ATOMIC POINT INCREMENT FUNCTION
-- Creates a stored procedure for atomically
-- incrementing employee total_points, preventing
-- race conditions from concurrent awards.
-- ============================================

CREATE OR REPLACE FUNCTION increment_points(emp_id UUID, pts INT)
RETURNS void AS $$
BEGIN
    UPDATE employees
    SET total_points = COALESCE(total_points, 0) + pts,
        updated_at = NOW()
    WHERE id = emp_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also add total_points column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employees' AND column_name = 'total_points'
    ) THEN
        ALTER TABLE employees ADD COLUMN total_points INT DEFAULT 0;
    END IF;
END $$;

-- Add avatar_url if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employees' AND column_name = 'avatar_url'
    ) THEN
        ALTER TABLE employees ADD COLUMN avatar_url TEXT;
    END IF;
END $$;
