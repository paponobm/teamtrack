CREATE TABLE "content_calendar_series" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "type_id" UUID NOT NULL,
    "gap_days" INTEGER NOT NULL DEFAULT 0,
    "days_of_week" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    "channel_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "content_calendar_series_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "content_calendar_series_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "content_calendar_types"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
CREATE INDEX "content_calendar_series_type_id_idx" ON "content_calendar_series"("type_id");

ALTER TABLE "content_calendar_items" ADD COLUMN "series_id" UUID;
ALTER TABLE "content_calendar_items" ADD CONSTRAINT "content_calendar_items_series_id_fkey"
    FOREIGN KEY ("series_id") REFERENCES "content_calendar_series"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
CREATE INDEX "content_calendar_items_series_id_idx" ON "content_calendar_items"("series_id");
