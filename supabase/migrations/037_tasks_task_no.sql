-- tasks.task_no (e.g. "TSK-0001") is already written by POST /api/tasks and read across
-- the UI (task cards, detail modal, work-comparison), but was never added via a tracked
-- migration — it must have been created out-of-band. Add it here so it's actually present.
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS task_no TEXT;
