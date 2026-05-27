-- 0075 — Seed _orphan project + reusable ghost briefs.
-- Use case: ext detect comment trên Reddit (qua page commentstats) cho
-- account × habitat đã có nhưng KHÔNG có brief nào match trong tất cả
-- projects → tạo ghost brief thuộc _orphan để vẫn track metrics
-- (views/score/upvote/replies). Sau này user có thể assign sang project
-- thật qua MOS2 UI (chuyển brief.project_id).
--
-- Naming '_orphan' (prefix underscore) để rõ ràng system project, không
-- nhầm với user-created projects.

INSERT INTO projects (id, tenant_id, name, emoji, mode_id, agents_core, agents_shared, budget, health, revenue, kpi, alerts, color, is_demo)
VALUES (
  '_orphan',
  'self',
  'Orphan (ghost briefs from ext)',
  '👻',
  'marketing',
  0, 0, 0, 0,
  '—',
  'Auto-imported insights chưa assign project',
  0,
  '#9ca3af',
  false
)
ON CONFLICT (id) DO NOTHING;
