-- 0072: Lưu meta của AI/Astrolas generation cho card.
-- User feedback: "cost cao + time lâu → lưu mọi kết quả draft lại + cho
-- select để xem lại + show meta cost/duration/model/confidence/tools".
--
-- Pattern: mỗi gen tạo card MỚI (cùng parent_url) → list = các card cùng
-- parent_url. Meta columns flat (không jsonb) để query/filter dễ.

ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS gen_cost_usd     decimal(8,5),
  ADD COLUMN IF NOT EXISTS gen_duration_ms  integer,
  ADD COLUMN IF NOT EXISTS gen_model_used   text,
  ADD COLUMN IF NOT EXISTS gen_confidence   decimal(3,2),
  ADD COLUMN IF NOT EXISTS gen_tools_called jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS gen_warnings     jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS gen_log_id       text;

-- Index parent_url để list drafts của 1 thread/post nhanh
CREATE INDEX IF NOT EXISTS cards_parent_url_idx ON cards(parent_url) WHERE parent_url IS NOT NULL;

COMMENT ON COLUMN cards.gen_cost_usd     IS 'USD cost của lần gen (Astrolas thường $0.05-0.20, OpenAI mini $0.001-0.01)';
COMMENT ON COLUMN cards.gen_duration_ms  IS 'Thời gian gen (ms). Astrolas reasoning 40-90s.';
COMMENT ON COLUMN cards.gen_model_used   IS 'claude-opus-4-7 / gpt-4.1-mini / o4-mini / ...';
COMMENT ON COLUMN cards.gen_confidence   IS '0..1 — Astrolas voice_signals.confidence';
COMMENT ON COLUMN cards.gen_tools_called IS 'Astrolas tools_called array: [batch_lookup_interp, find_interp_for_placement, ...]';
COMMENT ON COLUMN cards.gen_warnings     IS 'Astrolas warnings array';
COMMENT ON COLUMN cards.gen_log_id       IS 'Astrolas log_id để cross-ref bug report';
