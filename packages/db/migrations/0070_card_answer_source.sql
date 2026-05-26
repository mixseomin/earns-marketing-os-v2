-- 0070: Track nguồn của reply answer — phân biệt:
--   'manual':   user gõ tay
--   'ai':       MOS2 AI gen (gpt-4o-mini / gpt-5 / etc.)
--   'astrolas': Astrolas QA API trả về (data-backed, có sources[])
--
-- + answer_sources jsonb cho citations khi answer_source='astrolas'.

ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS answer_source  text,
  ADD COLUMN IF NOT EXISTS answer_sources jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN cards.answer_source  IS 'Nguồn của body_target: manual / ai / astrolas. NULL = unknown (legacy).';
COMMENT ON COLUMN cards.answer_sources IS 'Citations từ Astrolas QA: [{title, url, snippet, type}].';
