-- 0096: cards resolve account+habitat DIRECTLY (not only through brief). Until now cards had no
-- account_id/habitat_id — identity flowed card->brief->(account,habitat), forcing inbound/orphan posts to
-- fabricate a brief (the '_orphan' ghost in insights-by-thing-id). Now: nullable direct FKs, backfilled
-- from each card's brief. brief_id stays an OPTIONAL strategy pointer. Readers use COALESCE(card, brief).
ALTER TABLE cards ADD COLUMN IF NOT EXISTS account_id BIGINT REFERENCES platform_accounts(id) ON DELETE SET NULL;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS habitat_id BIGINT REFERENCES habitats(id) ON DELETE SET NULL;

-- Backfill all existing cards from their brief (card.account_id == brief.account_id for every current row,
-- so switching readers to COALESCE(card, brief) is behavior-preserving).
UPDATE cards c
   SET account_id = b.account_id,
       habitat_id = b.habitat_id
  FROM community_briefs b
 WHERE c.brief_id = b.id
   AND (c.account_id IS NULL OR c.habitat_id IS NULL);

CREATE INDEX IF NOT EXISTS cards_account_idx ON cards (account_id);
CREATE INDEX IF NOT EXISTS cards_habitat_idx ON cards (habitat_id);
