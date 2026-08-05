-- Link-post readiness gate, toggleable per platform. A link to a community is
-- sensitive (aged-but-dormant accounts dropping links get shadowbanned) — the gate
-- (lib/link-readiness.ts, enforced in advancePhase) requires earned community
-- standing before a link phase. Off by default; enabled for Reddit first.
ALTER TABLE platforms ADD COLUMN IF NOT EXISTS link_gate_enabled boolean NOT NULL DEFAULT false;
UPDATE platforms SET link_gate_enabled = true WHERE key = 'reddit';
