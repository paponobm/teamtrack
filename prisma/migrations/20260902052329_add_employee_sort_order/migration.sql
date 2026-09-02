-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "sort_order" INTEGER;

-- Backfill existing rows with sequential positions matching today's default listing order
-- (created_at DESC), so the new manual-ordering feature doesn't visually reshuffle anyone's
-- Members list the first time this migration runs.
WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) AS rn FROM "employees"
)
UPDATE "employees" e SET sort_order = ranked.rn
FROM ranked WHERE ranked.id = e.id;
