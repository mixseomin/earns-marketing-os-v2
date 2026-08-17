-- account_state + account_events — trạng thái ĐẦY ĐỦ của từng tài khoản network, giữ trong MOS2.
--
-- VÌ SAO: "Awin đã đăng ký site nào, mô tả ra sao, sector gì, đã xin chương trình nào, có API key
-- chưa" trước đây CHỈ nằm trên chính nền tảng. Muốn biết là phải mở browser đăng nhập — chat sau
-- không có đường nào khác, và mỗi lần đăng nhập lại là một lần rủi ro tài khoản. Đưa về đây để
-- tra bằng một lệnh (`acct show awin`).
--
-- account_events sinh bằng TRIGGER chứ không phải do người/agent nhớ ghi: mọi đường ghi vào
-- account_state (CLI, syncer, app) đều tự vào sổ. Đó là chỗ khác nhau giữa "có quy định phải log"
-- và "không log được kể cả khi muốn quên".

CREATE TABLE IF NOT EXISTS account_state (
  id          bigserial PRIMARY KEY,
  account_id  bigint NOT NULL REFERENCES platform_accounts(id) ON DELETE CASCADE,
  kind        text NOT NULL,                          -- property | profile | program | api | policy | payout
  ref         text NOT NULL,                          -- khoá tự nhiên phía nền tảng: domain, tên field, advertiser id
  data        jsonb NOT NULL DEFAULT '{}'::jsonb,
  status      text,
  synced_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_state_uniq UNIQUE (account_id, kind, ref)
);
CREATE INDEX IF NOT EXISTS account_state_acct_idx ON account_state (account_id, kind);

CREATE TABLE IF NOT EXISTS account_events (
  id          bigserial PRIMARY KEY,
  account_id  bigint NOT NULL,
  kind        text NOT NULL,
  ref         text NOT NULL,
  op          text NOT NULL,                          -- insert | update | delete
  before      jsonb,
  after       jsonb,
  at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS account_events_acct_idx ON account_events (account_id, at DESC);

CREATE OR REPLACE FUNCTION account_state_log() RETURNS trigger AS $fn$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO account_events (account_id, kind, ref, op, before, after)
      VALUES (OLD.account_id, OLD.kind, OLD.ref, 'delete',
              jsonb_build_object('data', OLD.data, 'status', OLD.status), NULL);
    RETURN OLD;
  END IF;

  -- re-sync mà không đổi gì thì không đẻ log, nếu không sổ sẽ đầy dòng rỗng và mất tác dụng
  IF TG_OP = 'UPDATE'
     AND NEW.data   IS NOT DISTINCT FROM OLD.data
     AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  INSERT INTO account_events (account_id, kind, ref, op, before, after)
    VALUES (NEW.account_id, NEW.kind, NEW.ref, lower(TG_OP),
            CASE WHEN TG_OP = 'UPDATE'
                 THEN jsonb_build_object('data', OLD.data, 'status', OLD.status) END,
            jsonb_build_object('data', NEW.data, 'status', NEW.status));
  RETURN NEW;
END $fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS account_state_log_trg ON account_state;
CREATE TRIGGER account_state_log_trg
  AFTER INSERT OR UPDATE OR DELETE ON account_state
  FOR EACH ROW EXECUTE FUNCTION account_state_log();
