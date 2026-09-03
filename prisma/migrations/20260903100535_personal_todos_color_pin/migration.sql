-- The To Do page's note color-picker and pin toggle were built against columns that were never
-- added to the table, causing every Add/Save to fail with "column does not exist".
ALTER TABLE "personal_todos" ADD COLUMN "color" TEXT;
ALTER TABLE "personal_todos" ADD COLUMN "is_pinned" BOOLEAN DEFAULT false;
