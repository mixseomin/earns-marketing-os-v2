-- Per-site execution time + schedule for backlink tasks. Stored in prep_payload:
--   site_done_at       = { slug: iso }  (auto-set when a site reaches completed/verified)
--   site_scheduled_at  = { slug: date } (planned date to do the task on that site)
-- Expose both on the `backlinks` view (appended columns → CREATE OR REPLACE is safe).
CREATE OR REPLACE VIEW backlinks AS
 SELECT ht.id,
    ht.project_id,
    ht.title,
    ht.status,
    ht.publish_url,
    ht.screenshot_url,
    ht.claimed_by,
    ht.instructions,
    ht.notes,
    ht.created_at,
    ht.updated_at,
    ht.prep_payload ->> 'source_url'::text AS source_url,
    ht.prep_payload ->> 'da'::text AS da,
    ht.prep_payload ->> 'dofollow'::text AS dofollow,
    ht.prep_payload ->> 'traffic'::text AS traffic,
    ht.prep_payload ->> 'rank'::text AS rank,
    ht.prep_payload ->> 'mechanism'::text AS mechanism,
    COALESCE(ht.prep_payload -> 'site_status'::text, '{}'::jsonb) AS site_status,
    COALESCE(ht.prep_payload -> 'site_url'::text, '{}'::jsonb) AS site_url,
    ht.prep_payload ->> 'draft'::text AS draft,
        CASE
            WHEN ht.prep_payload ? 'draft'::text THEN 'ready'::text
            ELSE ''::text
        END AS has_draft,
    COALESCE(( SELECT jsonb_agg(k.k ORDER BY k.k) AS jsonb_agg
           FROM jsonb_object_keys(COALESCE(ht.prep_payload -> 'site_status'::text, '{}'::jsonb)) k(k)), '[]'::jsonb) AS applies_to,
    ht.assigned_user_id,
    COALESCE(NULLIF(u.name, ''::text), u.email) AS assignee,
    COALESCE(ht.prep_payload -> 'site_done_at'::text, '{}'::jsonb) AS site_done_at,
    COALESCE(ht.prep_payload -> 'site_scheduled_at'::text, '{}'::jsonb) AS site_scheduled_at
   FROM human_tasks ht
     LEFT JOIN users u ON u.id = ht.assigned_user_id
  WHERE ht.platform_key = 'backlink'::text;
