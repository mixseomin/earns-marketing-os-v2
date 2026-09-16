-- PHỦ: nhật ký ĐỔI CÀI ĐẶT camp (trước → sau) để đọc kết quả theo mốc đổi. Anh ra 17/09/2026: "phải thêm trước và
-- sau setting để còn nắm được" — pause pop, hạ bid push, nâng bid direct đều làm qua API/UI, trang không có vết.
-- Ghi bằng TRIGGER trên phu_camp: adapter (ingest), form (luuPhuCamp), API, SQL tay — một đường ghi cho mọi đường sửa.
-- App muốn khai nguồn/lý do thì SET LOCAL phu.nguon / phu.ly_do trong cùng transaction; không khai = 'db'.
CREATE TABLE IF NOT EXISTS phu_camp_doi (
  id          bigserial PRIMARY KEY,
  project_id  text NOT NULL,
  sid_prefix  text NOT NULL,
  ts          timestamptz NOT NULL DEFAULT now(),
  truong      text NOT NULL,          -- tao · trang_thai · bid · ngan_sach_ngay · lander · target · tieu_chi · ket_thuc · ke_hoach
  cu          text,
  moi         text,
  nguon       text NOT NULL DEFAULT 'db',   -- adapter:<key> · tay · api · db
  ly_do       text
);
CREATE INDEX IF NOT EXISTS phu_camp_doi_camp_ts ON phu_camp_doi (project_id, sid_prefix, ts DESC);

CREATE OR REPLACE FUNCTION phu_camp_ghi_doi() RETURNS trigger AS $$
DECLARE
  n text := coalesce(nullif(current_setting('phu.nguon', true), ''), 'db');
  l text := nullif(current_setting('phu.ly_do', true), '');
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO phu_camp_doi (project_id, sid_prefix, truong, cu, moi, nguon, ly_do)
    VALUES (NEW.project_id, NEW.sid_prefix, 'tao', NULL,
            concat_ws(' · ', NEW.trang_thai, 'bid $' || (NEW.target->>'bid'), '$' || NEW.ngan_sach_ngay || '/ngày',
                      NEW.target->>'format', NEW.target->>'device', NEW.target->>'geo'), n, l);
    RETURN NEW;
  END IF;
  IF NEW.trang_thai IS DISTINCT FROM OLD.trang_thai THEN
    INSERT INTO phu_camp_doi (project_id, sid_prefix, truong, cu, moi, nguon, ly_do) VALUES (NEW.project_id, NEW.sid_prefix, 'trang_thai', OLD.trang_thai, NEW.trang_thai, n, l);
  END IF;
  IF (NEW.target->>'bid') IS DISTINCT FROM (OLD.target->>'bid') THEN
    INSERT INTO phu_camp_doi (project_id, sid_prefix, truong, cu, moi, nguon, ly_do) VALUES (NEW.project_id, NEW.sid_prefix, 'bid', OLD.target->>'bid', NEW.target->>'bid', n, l);
  END IF;
  IF (NEW.target->>'editorial') IS DISTINCT FROM (OLD.target->>'editorial') THEN
    INSERT INTO phu_camp_doi (project_id, sid_prefix, truong, cu, moi, nguon, ly_do) VALUES (NEW.project_id, NEW.sid_prefix, 'editorial', OLD.target->>'editorial', NEW.target->>'editorial', n, l);
  END IF;
  IF NEW.ngan_sach_ngay IS DISTINCT FROM OLD.ngan_sach_ngay THEN
    INSERT INTO phu_camp_doi (project_id, sid_prefix, truong, cu, moi, nguon, ly_do) VALUES (NEW.project_id, NEW.sid_prefix, 'ngan_sach_ngay', OLD.ngan_sach_ngay::text, NEW.ngan_sach_ngay::text, n, l);
  END IF;
  IF NEW.lander IS DISTINCT FROM OLD.lander THEN
    INSERT INTO phu_camp_doi (project_id, sid_prefix, truong, cu, moi, nguon, ly_do) VALUES (NEW.project_id, NEW.sid_prefix, 'lander', OLD.lander, NEW.lander, n, l);
  END IF;
  IF (NEW.target - 'bid' - 'editorial' - 'bv_id') IS DISTINCT FROM (OLD.target - 'bid' - 'editorial' - 'bv_id') THEN
    INSERT INTO phu_camp_doi (project_id, sid_prefix, truong, cu, moi, nguon, ly_do) VALUES (NEW.project_id, NEW.sid_prefix, 'target', (OLD.target - 'bid' - 'editorial' - 'bv_id')::text, (NEW.target - 'bid' - 'editorial' - 'bv_id')::text, n, l);
  END IF;
  IF NEW.tieu_chi IS DISTINCT FROM OLD.tieu_chi THEN
    INSERT INTO phu_camp_doi (project_id, sid_prefix, truong, cu, moi, nguon, ly_do) VALUES (NEW.project_id, NEW.sid_prefix, 'tieu_chi', OLD.tieu_chi::text, NEW.tieu_chi::text, n, l);
  END IF;
  IF NEW.ket_thuc IS DISTINCT FROM OLD.ket_thuc THEN
    INSERT INTO phu_camp_doi (project_id, sid_prefix, truong, cu, moi, nguon, ly_do) VALUES (NEW.project_id, NEW.sid_prefix, 'ket_thuc', OLD.ket_thuc::text, NEW.ket_thuc::text, n, l);
  END IF;
  IF NEW.ke_hoach IS DISTINCT FROM OLD.ke_hoach THEN
    INSERT INTO phu_camp_doi (project_id, sid_prefix, truong, cu, moi, nguon, ly_do) VALUES (NEW.project_id, NEW.sid_prefix, 'ke_hoach', OLD.ke_hoach, NEW.ke_hoach, n, l);
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS phu_camp_doi_trg ON phu_camp;
CREATE TRIGGER phu_camp_doi_trg AFTER INSERT OR UPDATE ON phu_camp FOR EACH ROW EXECUTE FUNCTION phu_camp_ghi_doi();

-- Lịch sử đã biết trước khi có nhật ký (adfond / Bidvertiser), để "trước" không bắt đầu từ hôm nay.
INSERT INTO phu_camp_doi (project_id, sid_prefix, ts, truong, cu, moi, nguon, ly_do) VALUES
  ('adfond','bidvertiser_pop-us-d','2026-09-14 12:00+00','tao',NULL,'chay · bid $0.0025 · $5/ngày · POP-UNDER · DESKTOP · US','tay','Lên camp theo plan-bidvertiser-live (bậc 1 US)'),
  ('adfond','bidvertiser_pop-us-m','2026-09-14 12:00+00','tao',NULL,'chay · bid $0.0036 · $5/ngày · POP-UNDER · MOBILE · US','tay','Lên camp theo plan-bidvertiser-live (bậc 1 US)'),
  ('adfond','bidvertiser_pop-us-m','2026-09-14 18:30+00','bid','0.0036','0.0012','tay','Anh chốt hạ bid mobile (cap chạm quá sớm)'),
  ('adfond','bidvertiser_pop-us-d','2026-09-14 19:36+00','lander','có cổng 18+','bỏ cổng 18+','tay','Cổng 18+ chỉ 3,5% qua → bỏ (anh chốt 15/09)'),
  ('adfond','bidvertiser_pop-us-m','2026-09-14 19:36+00','lander','có cổng 18+','bỏ cổng 18+','tay','Cổng 18+ chỉ 3,5% qua → bỏ (anh chốt 15/09)'),
  ('adfond','bidvertiser_pop-us-d','2026-09-15 08:30+00','bid','0.0025','0.0018','api','Cap $5 chạm sau vài giờ → bid cao hơn cần'),
  ('adfond','bidvertiser_pop-us-m','2026-09-15 08:30+00','bid','0.0012','0.0009','api','Cap $5 chạm sau vài giờ → bid cao hơn cần'),
  ('adfond','bidvertiser_direct-us','2026-09-15 09:00+00','tao',NULL,'chay · bid $0.01 · $5/ngày · DIRECT · keyword cam · US','tay','Anh duyệt mở Direct (keyword chaturbate/live cam…)'),
  ('adfond','bidvertiser_push-us','2026-09-15 09:00+00','tao',NULL,'chay · bid $0.02 · $5/ngày · PUSH · US','tay','Anh duyệt mở Push → Chaturbate'),
  ('adfond','bidvertiser_pop-us-d','2026-09-16 17:40+00','trang_thai','chay','tam_dung','api','$0,113/click > trần $0,03 sau 135 click (anh duyệt "làm cả 4")'),
  ('adfond','bidvertiser_pop-us-m','2026-09-16 17:40+00','trang_thai','chay','tam_dung','api','$0,111/click > trần $0,03 sau 129 click'),
  ('adfond','bidvertiser_push-us','2026-09-16 17:40+00','bid','0.02','0.01','api','CTR 24% nhưng $0,081/click → hạ về sàn, mục tiêu ~$0,04'),
  ('adfond','bidvertiser_direct-us','2026-09-16 17:40+00','bid','0.01','0.03','api','29 view/2 ngày = thua thầu keyword → nâng để có số'),
  ('adfond','bidvertiser_push-dating','2026-09-16 18:05+00','tao',NULL,'chay · bid $0.02 · $5/ngày · PUSH · US → CR Dating Smartlink 9986','tay','A/B offer: lead-based vs Chaturbate revshare');
