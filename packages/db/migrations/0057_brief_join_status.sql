-- 0057_brief_join_status.sql — track membership state per (account, habitat).
--
-- Before this migration, community_briefs.currentPhase was the only state per
-- brief, but it didn't capture "has this account ACTUALLY JOINED the community
-- yet?" — critical for Discord (accept invite), FB groups (admin approve),
-- subreddits (subscribe + min karma), Slack (workspace invite), LinkedIn
-- groups (join request → approve). Without this, phase=warm-up is misleading
-- because warming requires being inside the community first.
--
-- Design: standalone enum independent of phase. Phase warm-up only meaningful
-- when joinStatus='joined'. Pre-join states (not_joined, pending) gate seeding.
-- Post-membership states (left, kicked, rejected) allow record-keeping without
-- deleting the brief (history + retry context).

ALTER TABLE community_briefs
  ADD COLUMN IF NOT EXISTS join_status   text NOT NULL DEFAULT 'not_joined',
  ADD COLUMN IF NOT EXISTS joined_at     timestamptz,
  ADD COLUMN IF NOT EXISTS join_url      text,
  ADD COLUMN IF NOT EXISTS join_note     text;

-- Backfill: existing briefs were created assuming user already in community
-- (legacy workflow). Mark them joined with createdAt as joined_at proxy.
UPDATE community_briefs
   SET join_status = 'joined',
       joined_at   = COALESCE(joined_at, created_at)
 WHERE join_status = 'not_joined';

-- Constraint enum check (defensive — text + check, not pg enum, to allow easy
-- future additions without DROP/CREATE TYPE).
ALTER TABLE community_briefs
  DROP CONSTRAINT IF EXISTS community_briefs_join_status_chk;
ALTER TABLE community_briefs
  ADD CONSTRAINT community_briefs_join_status_chk
    CHECK (join_status IN ('not_joined','pending','joined','rejected','kicked','left'));

CREATE INDEX IF NOT EXISTS community_briefs_join_status_idx
  ON community_briefs(join_status);

-- App user grants (mos2 is the runtime role, separate from earns superuser).
GRANT SELECT, INSERT, UPDATE, DELETE ON community_briefs TO mos2;
