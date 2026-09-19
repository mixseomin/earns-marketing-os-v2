-- Sổ TIẾN ĐỘ theo dự án (20/09/2026, anh chốt): hạng mục → bước → trạng thái, gắn project_id. Đổi tên từ y_tuong
-- (dựng sáng nay, chỉ có nhóm iOS) và GOM Plan Cockpit (plans/plan_goals/plan_steps, 3 plan, gần như không dùng)
-- về một bảng. Khuôn = sheet "Bra Shop 2026": ID · Hạng mục · Ưu · Trạng thái · Tiến độ · Bước hiện tại · Mô tả ·
-- Ghi chú · Ai · Số · Cổng đi/dừng · Cập nhật · Link · Tab.
DO $$ BEGIN
  IF to_regclass('y_tuong') IS NOT NULL AND to_regclass('tien_do_hang_muc') IS NULL THEN
    ALTER TABLE y_tuong RENAME TO tien_do_hang_muc;
    ALTER TABLE y_tuong_buoc RENAME TO tien_do_buoc;
    ALTER TABLE tien_do_buoc RENAME COLUMN y_tuong_id TO hang_muc_id;
    ALTER TABLE y_tuong_nhat_ky RENAME TO tien_do_nhat_ky;
    ALTER TABLE tien_do_nhat_ky RENAME COLUMN y_tuong_id TO hang_muc_id;
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS tien_do_hang_muc (
  id serial PRIMARY KEY, nhom text NOT NULL, ma text NOT NULL, ten text NOT NULL, uu_tien smallint NOT NULL DEFAULT 2,
  trang_thai text NOT NULL DEFAULT 'Ý tưởng', lan text NOT NULL DEFAULT '', goc text NOT NULL DEFAULT '', mo_ta text NOT NULL DEFAULT '',
  ghi_chu text NOT NULL DEFAULT '', link text NOT NULL DEFAULT '', tab text NOT NULL DEFAULT '', project_id text REFERENCES projects(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (nhom, ma));
CREATE TABLE IF NOT EXISTS tien_do_buoc (
  id serial PRIMARY KEY, hang_muc_id int NOT NULL REFERENCES tien_do_hang_muc(id) ON DELETE CASCADE, thu_tu int NOT NULL, buoc text NOT NULL,
  trang_thai text NOT NULL DEFAULT 'Chưa', ngay_xong date, ket_qua text NOT NULL DEFAULT '', ghi_chu text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (hang_muc_id, thu_tu));
CREATE TABLE IF NOT EXISTS tien_do_nhat_ky (
  id bigserial PRIMARY KEY, hang_muc_id int NOT NULL REFERENCES tien_do_hang_muc(id) ON DELETE CASCADE,
  buoc_id int REFERENCES tien_do_buoc(id) ON DELETE SET NULL, ts timestamptz NOT NULL DEFAULT now(), noi_dung text NOT NULL);
-- cột theo khuôn Bra: Ai (người làm) · Số (chỉ số, JSON key→value vì mỗi dự án đo thứ khác) · Cổng đi/dừng · nguồn nhập (khử trùng)
ALTER TABLE tien_do_hang_muc ADD COLUMN IF NOT EXISTS ai text NOT NULL DEFAULT '';
ALTER TABLE tien_do_hang_muc ADD COLUMN IF NOT EXISTS so jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE tien_do_hang_muc ADD COLUMN IF NOT EXISTS cong text NOT NULL DEFAULT '';
ALTER TABLE tien_do_hang_muc ADD COLUMN IF NOT EXISTS nguon text;
CREATE UNIQUE INDEX IF NOT EXISTS tien_do_hang_muc_nguon ON tien_do_hang_muc (nguon) WHERE nguon IS NOT NULL;
CREATE INDEX IF NOT EXISTS tien_do_hang_muc_project ON tien_do_hang_muc (project_id, nhom, ma);
-- project "App iOS" = làn app iOS nói chung (Wordfrost là hạng mục đầu; project wordfrost riêng vẫn giữ cho analytics/followup)
INSERT INTO projects (id, name, emoji, mode_id, website, one_liner, color)
  VALUES ('ios-app', 'App iOS', '📱', 'content-studio', 'https://wordfrost.com', 'Làn app iOS: bản free của web game thu phí, ăn quảng cáo; shell chung + nhiều title', '#8fd3ff')
  ON CONFLICT (id) DO NOTHING;
UPDATE tien_do_hang_muc SET project_id = 'ios-app' WHERE nhom = 'iOS' AND project_id IS NULL;
-- GOM Plan Cockpit: plan → nhóm (tên plan), goal → hạng mục, step → bước. Khử trùng bằng nguon='plan_goal:<id>'.
INSERT INTO tien_do_hang_muc (nhom, ma, ten, uu_tien, trang_thai, mo_ta, ghi_chu, ai, so, cong, project_id, nguon, created_at)
SELECT p.name, 'P' || p.id || '-' || lpad((row_number() OVER (PARTITION BY g.plan_id ORDER BY g.order_index, g.id))::text, 2, '0'),
       g.name, 2,
       CASE g.status WHEN 'doing' THEN 'Đang làm' WHEN 'done' THEN 'Xong' WHEN 'blocked' THEN 'Kẹt' WHEN 'skipped' THEN 'Bỏ' ELSE 'Ý tưởng' END,
       COALESCE(g.description, ''), COALESCE('Gom từ Plan Cockpit plan #' || p.id || ' (' || p.slug || ', ' || p.status || ')', ''),
       COALESCE(p.owner_user_id, ''),
       CASE WHEN g.target_value IS NOT NULL THEN jsonb_build_object(COALESCE(g.target_unit, 'mục tiêu'), g.current_value || ' / ' || g.target_value) ELSE '{}'::jsonb END,
       COALESCE('hạn ' || g.deadline::text, ''),
       CASE p.slug WHEN 'creator-economy-newsletter' THEN 'creator-econ-news' WHEN 'hyperjournal-x-outreach' THEN 'hyperjournal' WHEN 'trafficfactory-native-pha-1' THEN 'adfond' ELSE NULL END,
       'plan_goal:' || g.id, g.created_at
FROM plan_goals g JOIN plans p ON p.id = g.plan_id
WHERE to_regclass('plan_goals') IS NOT NULL
ON CONFLICT (nguon) DO NOTHING;
INSERT INTO tien_do_buoc (hang_muc_id, thu_tu, buoc, trang_thai, ngay_xong, ket_qua, ghi_chu, updated_at)
SELECT h.id, row_number() OVER (PARTITION BY s.goal_id ORDER BY s.order_index, s.id),
       s.name || CASE WHEN s.channel IS NOT NULL THEN ' [' || s.channel || COALESCE(' ' || s.channel_target, '') || ']' ELSE '' END,
       CASE s.status WHEN 'doing' THEN 'Đang' WHEN 'done' THEN 'Xong' WHEN 'blocked' THEN 'Kẹt' WHEN 'skipped' THEN 'Bỏ' ELSE 'Chưa' END,
       CASE WHEN s.status = 'done' THEN s.updated_at::date END,
       COALESCE(s.evidence_url, ''), trim(both ' · ' from COALESCE(s.notes, '') || CASE WHEN s.due_date IS NOT NULL THEN ' · hạn ' || s.due_date ELSE '' END),
       s.updated_at
FROM plan_steps s JOIN tien_do_hang_muc h ON h.nguon = 'plan_goal:' || s.goal_id
WHERE to_regclass('plan_steps') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM tien_do_buoc b WHERE b.hang_muc_id = h.id);
