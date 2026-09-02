-- Convert order_type from a single value to an array so an order can be tagged with more than
-- one type at once (e.g. both "Suggested" and "2000+"). Existing rows are converted to a
-- single-element array so no data is lost.
ALTER TABLE "work_entries"
    ALTER COLUMN "order_type" TYPE TEXT[]
    USING CASE WHEN "order_type" IS NULL THEN NULL ELSE ARRAY["order_type"] END;
