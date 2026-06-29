-- backlinks: view gom TẤT CẢ task đặt backlink (human_tasks platform_key='backlink')
-- thành 1 node trong Architecture Studio (cross-project). Auto-updatable view cho cột
-- simple → sửa status/publish_url/notes trong drawer vẫn ghi xuống human_tasks.
-- applies_to = ĐỀ XUẤT project áp dụng (derived, read-only): nguồn niche-agnostic →
-- gợi ý cả 3 site tool; nguồn vertical → chỉ site của nó. project = site nhận backlink.
CREATE OR REPLACE VIEW backlinks AS
  SELECT id, project_id, title, status, publish_url, screenshot_url,
         claimed_by, instructions, notes, created_at, updated_at,
         CASE WHEN title ~* '(Featured|Qwoted|Source of Sources|YouTube|Hacker News|HackerNoon|Indie Hackers|Cool Tools|Substack|Flipboard|Pinterest|Softpedia|WebCatalog|MentionMatch|SourceBottle|JournoRequest|dev\.to|WordPress|Crunchbase|Product Hunt|AlternativeTo|SaaSHub|Medium|LinkedIn|Quora|llms|BetaList|Wikidata|GitHub)'
              THEN '["militarycalc","govcalcs","visagps"]'::jsonb
              ELSE jsonb_build_array(project_id)
         END AS applies_to
  FROM human_tasks
  WHERE platform_key = 'backlink';
