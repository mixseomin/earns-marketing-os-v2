-- 0134 — link an outreach prospect to its backlink task for 2-way status sync (work in either
-- surface, shared status). Backfill from the existing "từ backlink task #<id>" notes marker.
ALTER TABLE outreach_prospects ADD COLUMN IF NOT EXISTS task_id bigint;
CREATE INDEX IF NOT EXISTS outreach_prospects_task_idx ON outreach_prospects(task_id);
UPDATE outreach_prospects
SET task_id = (substring(notes FROM '#(\d+)'))::bigint
WHERE task_id IS NULL AND notes ~ 'backlink task #\d+';
