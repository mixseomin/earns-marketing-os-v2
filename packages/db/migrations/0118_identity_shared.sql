-- Allow an identity to be SHARED across all projects: project_id NULL = global persona.
-- Idempotent: DROP NOT NULL is a no-op if already nullable.
ALTER TABLE identities ALTER COLUMN project_id DROP NOT NULL;
