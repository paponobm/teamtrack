-- The "Add PR Entry" form now supports attaching multiple video links (numbered rows,
-- + button to add another). Kept as a new array column rather than overloading the
-- existing `video_link` TEXT column, so PR Management's own table/action-icon (which
-- treats video_link as a single URL) keeps working completely unchanged for every
-- existing row. `video_link` is still populated (first link) for that backward compat.
ALTER TABLE public.pr_management ADD COLUMN IF NOT EXISTS video_links TEXT[] NOT NULL DEFAULT '{}';
