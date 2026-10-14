CREATE TABLE "content_calendar_occasions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "lead_days" INTEGER NOT NULL DEFAULT 14,
    "target" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "content_calendar_occasions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "content_calendar_occasions_date_idx" ON "content_calendar_occasions"("date");

ALTER TABLE "content_calendar_items" ADD COLUMN "occasion_id" UUID;
ALTER TABLE "content_calendar_items" ADD CONSTRAINT "content_calendar_items_occasion_id_fkey"
    FOREIGN KEY ("occasion_id") REFERENCES "content_calendar_occasions"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
CREATE INDEX "content_calendar_items_occasion_id_idx" ON "content_calendar_items"("occasion_id");
