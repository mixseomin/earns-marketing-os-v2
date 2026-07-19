-- Backlink instruction "grounding": expose whether a task's instructions were rewritten against
-- the real captured DOM (prep_payload.grounded), plus a pointer to the latest dom_samples row for
-- the task's source host so the drawer can show a small "🔎 DOM" check link. Append-only → CREATE
-- OR REPLACE is safe. See decision 2026-07-19-backlink-source-catalog-standardization (DOM-grounding).
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
    COALESCE(ht.prep_payload -> 'site_scheduled_at'::text, '{}'::jsonb) AS site_scheduled_at,
    COALESCE(ht.prep_payload -> 'site_submitted_at'::text, '{}'::jsonb) AS site_submitted_at,
    COALESCE(ht.prep_payload -> 'site_verify'::text, '{}'::jsonb) AS site_verify,
    ht.prep_payload ->> 'worker_note'::text AS worker_note,
    ht.prep_payload -> 'blocker'::text AS blocker,
    COALESCE(ht.prep_payload -> 'draft_images'::text, '[]'::jsonb) AS draft_images,
    ht.prep_payload ->> 'draft_short'::text AS draft_short,
    ht.prep_payload -> 'resolved'::text AS resolved,
    ht.prep_payload -> 'grounded'::text AS grounded,
    ( SELECT ds.id FROM dom_samples ds
        WHERE ds.hostname = lower(regexp_replace(ht.prep_payload ->> 'source_url'::text, '^https?://(www\.)?([^/]+).*$'::text, '\2'::text))
        ORDER BY ds.captured_at DESC LIMIT 1) AS dom_sample_id
   FROM human_tasks ht
     LEFT JOIN users u ON u.id = ht.assigned_user_id
  WHERE ht.platform_key = 'backlink'::text;
