-- 0062: ext_call_log - debug log mọi call từ ext MOS2 Crew lên server.
--
-- User feedback (2026-05-24): 'hãy cho thêm version call đến server để tự
-- biết lỗi ở đâu luôn'. Khi LLM learn-selectors trả {} empty, hoặc ext
-- không trigger POST đúng cách, cần audit trail server-side.
--
-- Mỗi POST /api/ext/* sẽ insert 1 row. Auto-prune sau 7 ngày qua cron
-- riêng (chưa làm).

CREATE TABLE IF NOT EXISTS ext_call_log (
  id            bigserial PRIMARY KEY,
  endpoint      text NOT NULL,           -- 'learn-selectors' | 'habitats' | ...
  method        text NOT NULL,           -- 'GET' | 'POST'
  ext_version   text,                    -- '1.4.14' (từ X-Ext-Version header)
  page_url      text,                    -- URL Reddit page lúc gọi
  payload_meta  jsonb,                   -- {fields, html_size, platform_key, ...}
  response_meta jsonb,                   -- {ok, selectors_count, error?, model?}
  status        integer,                 -- HTTP response status
  duration_ms   integer,                 -- thời gian xử lý
  error_msg     text,                    -- catch error message
  created_at    timestamp with time zone NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ext_call_log_endpoint_idx
  ON ext_call_log (endpoint, created_at DESC);
CREATE INDEX IF NOT EXISTS ext_call_log_created_idx
  ON ext_call_log (created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON ext_call_log TO mos2;
GRANT USAGE, SELECT ON SEQUENCE ext_call_log_id_seq TO mos2;
