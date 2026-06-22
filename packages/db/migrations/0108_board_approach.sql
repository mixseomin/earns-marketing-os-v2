-- Seeding Radar (2026-06-22): per-(board×project) approach/angle. Low fit is often the wrong
-- approach, not an unusable board — adjusting the angle (e.g. "use astrology to analyze
-- celebrities" on an entertainment board) can raise fit. Account-free (project-level).
-- Editing approach marks the row stale → next /boards/score re-scores with the angle.
ALTER TABLE board_project_score ADD COLUMN IF NOT EXISTS approach text NOT NULL DEFAULT '';
