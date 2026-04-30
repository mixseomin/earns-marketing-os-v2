-- Phase 8 — API token encryption: enable pgcrypto extension.
-- Idempotent. Used by lib/crypto.ts to encrypt secrets like
-- platform_accounts.api_token_enc and infra_resources secret meta fields.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
