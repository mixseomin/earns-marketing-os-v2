-- Assign a backlink task to a team user (human_tasks.assigned_user_id). Ext staff
-- then see it via /api/ext/my-tasks (WHERE assigned_user_id = them). Expose the
-- assigned_user_id + resolved name on the view so the Studio node can show/edit it.
-- LEFT JOIN users → view is read-only (fine: all writes go to human_tasks directly).
DROP VIEW IF EXISTS backlinks;
CREATE VIEW backlinks AS
  SELECT ht.id, ht.project_id, ht.title, ht.status, ht.publish_url, ht.screenshot_url, ht.claimed_by,
         ht.instructions, ht.notes, ht.created_at, ht.updated_at,
         ht.prep_payload->>'source_url' AS source_url,
         ht.prep_payload->>'da'         AS da,
         ht.prep_payload->>'dofollow'   AS dofollow,
         ht.prep_payload->>'traffic'    AS traffic,
         ht.prep_payload->>'rank'       AS rank,
         ht.prep_payload->>'mechanism'  AS mechanism,
         COALESCE(ht.prep_payload->'site_status', '{}'::jsonb) AS site_status,
         COALESCE(ht.prep_payload->'site_url',    '{}'::jsonb) AS site_url,
         ht.prep_payload->>'draft'      AS draft,
         CASE WHEN ht.prep_payload ? 'draft' THEN 'ready' ELSE '' END AS has_draft,
         COALESCE(
           (SELECT jsonb_agg(k ORDER BY k)
              FROM jsonb_object_keys(COALESCE(ht.prep_payload->'site_status', '{}'::jsonb)) AS k),
           '[]'::jsonb
         ) AS applies_to,
         ht.assigned_user_id,
         COALESCE(NULLIF(u.name, ''), u.email) AS assignee
  FROM human_tasks ht
  LEFT JOIN users u ON u.id = ht.assigned_user_id
  WHERE ht.platform_key = 'backlink';
