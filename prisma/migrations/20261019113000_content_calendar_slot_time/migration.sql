-- Optional time-of-day for a scheduled post, alongside the existing date-only column.
ALTER TABLE "content_calendar_slots" ADD COLUMN "time" TIME;
