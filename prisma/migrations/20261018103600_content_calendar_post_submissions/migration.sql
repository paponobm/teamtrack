-- Evolve the Idea Bank into the richer Post Bank: free-text "ধরন" instead of a real type,
-- a full caption field, a review workflow (pending/idea/returned/scheduled), and a link to the
-- content item once scheduled. Existing rows are preserved, not dropped.

ALTER TABLE "content_calendar_ideas" ADD COLUMN "caption" TEXT;
ALTER TABLE "content_calendar_ideas" ADD COLUMN "type_text" TEXT;
ALTER TABLE "content_calendar_ideas" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'idea';
ALTER TABLE "content_calendar_ideas" ADD COLUMN "return_note" TEXT;
ALTER TABLE "content_calendar_ideas" ADD COLUMN "scheduled_item_id" UUID;
ALTER TABLE "content_calendar_ideas" ADD COLUMN "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP;

-- Backfill type_text from the old type_id relation before it's dropped.
UPDATE "content_calendar_ideas" i SET "type_text" = t."name"
    FROM "content_calendar_types" t WHERE t."id" = i."type_id";

ALTER TABLE "content_calendar_ideas" DROP CONSTRAINT IF EXISTS "content_calendar_ideas_type_id_fkey";
DROP INDEX IF EXISTS "content_calendar_ideas_type_id_idx";
ALTER TABLE "content_calendar_ideas" DROP COLUMN "type_id";
ALTER TABLE "content_calendar_ideas" DROP COLUMN "product_code";
ALTER TABLE "content_calendar_ideas" DROP COLUMN "notes";

ALTER TABLE "content_calendar_ideas" RENAME TO "content_calendar_post_submissions";

ALTER TABLE "content_calendar_post_submissions" ADD CONSTRAINT "content_calendar_post_submissions_scheduled_item_id_fkey"
    FOREIGN KEY ("scheduled_item_id") REFERENCES "content_calendar_items"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
CREATE INDEX "content_calendar_post_submissions_status_idx" ON "content_calendar_post_submissions"("status");
