-- Paste-ready content per backlink task: prep_payload.draft (English content staff copy + post).
-- View exposes draft + has_draft (triage badge). DROP+CREATE (column added).
DROP VIEW IF EXISTS backlinks;
CREATE VIEW backlinks AS
  SELECT id, project_id, title, status, publish_url, screenshot_url, claimed_by,
         instructions, notes, created_at, updated_at,
         prep_payload->>'source_url' AS source_url,
         prep_payload->>'da'         AS da,
         prep_payload->>'dofollow'   AS dofollow,
         prep_payload->>'traffic'    AS traffic,
         prep_payload->>'rank'       AS rank,
         prep_payload->>'mechanism'  AS mechanism,
         COALESCE(prep_payload->'site_status', '{}'::jsonb) AS site_status,
         COALESCE(prep_payload->'site_url',    '{}'::jsonb) AS site_url,
         prep_payload->>'draft'      AS draft,
         CASE WHEN prep_payload ? 'draft' THEN 'ready' ELSE '' END AS has_draft,
         CASE WHEN title ~* '(Featured|Qwoted|Source of Sources|YouTube|Hacker News|HackerNoon|Indie Hackers|Cool Tools|Substack|Flipboard|Pinterest|Softpedia|WebCatalog|MentionMatch|SourceBottle|JournoRequest|dev\.to|WordPress|Crunchbase|Product Hunt|AlternativeTo|SaaSHub|Medium|LinkedIn|Quora|llms|BetaList|Wikidata|GitHub)'
              THEN '["militarycalc","govcalcs","visagps"]'::jsonb
              ELSE jsonb_build_array(project_id)
         END AS applies_to
  FROM human_tasks
  WHERE platform_key = 'backlink';
