-- 0077: habitats.is_own — flag "habitat thuộc về brand mình quản lý"
-- (vd: Discord server own brand, FB group của project, subreddit do user mod).
-- Khác external habitat (community open của bên thứ 3 mà ta engage).
--
-- UI hiển thị chỉ báo 👑 trên row → user phân biệt nhanh khi list nhiều.
-- AI prompt có thể dùng flag để đổi tone (own community = trực diện brand,
-- external = subtle/contextual).

ALTER TABLE habitats
  ADD COLUMN IF NOT EXISTS is_own boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN habitats.is_own IS
  'true = habitat thuộc brand mình quản lý (own Discord/FB group/subreddit). false = external community ta engage.';

-- Heuristic seed: habitat.name == project.name → coi như own (auto-set).
-- User có thể edit flag manual sau qua habitat modal.
UPDATE habitats h
   SET is_own = true
  FROM projects p
 WHERE h.project_id = p.id
   AND lower(trim(h.name)) = lower(trim(p.name))
   AND h.is_own = false;
