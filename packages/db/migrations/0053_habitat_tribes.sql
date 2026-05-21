-- 0053: habitat ↔ tribe many-to-many.
-- habitats.tribe_id is KEPT as a denormalized "primary tribe" mirror so
-- all existing single-tribe reads keep working. habitat_tribes is the
-- full set; exactly one row per habitat has is_primary=true and that
-- tribe must equal habitats.tribe_id (app code keeps them in sync).
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS habitat_tribes (
  id          BIGSERIAL PRIMARY KEY,
  tenant_id   TEXT NOT NULL DEFAULT 'self',
  habitat_id  INTEGER NOT NULL REFERENCES habitats(id) ON DELETE CASCADE,
  tribe_id    INTEGER NOT NULL REFERENCES tribes(id)   ON DELETE CASCADE,
  is_primary  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS habitat_tribes_uniq        ON habitat_tribes (habitat_id, tribe_id);
CREATE INDEX        IF NOT EXISTS habitat_tribes_tribe_idx   ON habitat_tribes (tribe_id);
CREATE INDEX        IF NOT EXISTS habitat_tribes_habitat_idx ON habitat_tribes (habitat_id);
CREATE INDEX        IF NOT EXISTS habitat_tribes_tenant_idx  ON habitat_tribes (tenant_id);
-- at most one primary per habitat
CREATE UNIQUE INDEX IF NOT EXISTS habitat_tribes_one_primary ON habitat_tribes (habitat_id) WHERE is_primary;

-- Backfill: every habitat currently pointing at a tribe → primary row.
INSERT INTO habitat_tribes (tenant_id, habitat_id, tribe_id, is_primary)
SELECT h.tenant_id, h.id, h.tribe_id, true
FROM habitats h
WHERE h.tribe_id IS NOT NULL
ON CONFLICT (habitat_id, tribe_id) DO NOTHING;
