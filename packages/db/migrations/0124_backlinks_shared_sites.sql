-- Backlink source = one shared cross-project entity. Sites it targets live in
-- prep_payload.site_status (per-site status). Two changes:
--   1. Seed: expand every portfolio-wide source (already targets mc+gov+visa) to
--      also cover the other live product sites: paydochub, maileyes, chatlt.
--      Seed-first || existing-second so we never clobber a site's current status.
--   2. applies_to now reflects REAL membership (site_status keys), not a title
--      regex. After the seed it auto-includes the new sites.

UPDATE human_tasks
SET prep_payload = jsonb_set(
      prep_payload, '{site_status}',
      '{"paydochub":"pending","maileyes":"pending","chatlt":"pending"}'::jsonb
        || COALESCE(prep_payload->'site_status', '{}'::jsonb))
WHERE platform_key = 'backlink'
  AND prep_payload->'site_status' ? 'militarycalc'
  AND prep_payload->'site_status' ? 'govcalcs'
  AND prep_payload->'site_status' ? 'visagps';

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
         COALESCE(
           (SELECT jsonb_agg(k ORDER BY k)
              FROM jsonb_object_keys(COALESCE(prep_payload->'site_status', '{}'::jsonb)) AS k),
           '[]'::jsonb
         ) AS applies_to
  FROM human_tasks
  WHERE platform_key = 'backlink';
