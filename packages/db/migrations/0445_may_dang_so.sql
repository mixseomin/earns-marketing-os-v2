-- SỔ LƯỢT ĐĂNG — tab Máy Đăng trên mos2 (anh 09/11/2026: "liệt kê từng query đăng từ mới nhất xuống. Mỗi bước cụ thể phải thành từng cột …
-- Các bước hay lỗi phải có cột chi tiết để thống kê và tập trung fix"). Một dòng = một lượt máy đăng xét một kênh × một nền.
-- Ghi bởi: puzzle-books scripts/dang-may.mjs + dang-short.mjs in dòng `@@luot {…}` → dang-lien-tuc.mjs gom một gói cuối vòng 10 phút
-- → apps/xuong-video/scripts/may-dung.mts --trang-thai (luot[]). Không thêm ssh nào trong lúc đăng.
-- Phòng phụ trách: Phòng Social Traffic (apps/cty/cong-ty/phong/social-traffic.md).

-- MÃ LÝ DO — MỘT nguồn phân loại cho cả lỗi lẫn lý do dừng (máy không tự đoán nhóm, trang không regex lại): chữ máy viết → mã ổn định.
CREATE OR REPLACE FUNCTION may_dang_ma_ly(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN t IS NULL OR t = '' THEN NULL
    WHEN t ~* 'hết video|hết bài' THEN 'het-bai'
    WHEN t ~* 'chưa tới hạn' THEN 'chua-han'
    WHEN t ~* 'kênh hẹn giờ' THEN 'kenh-hen-gio'
    WHEN t ~* 'nghỉ tới' THEN 'nghi-nen'
    WHEN t ~* 'kênh chết' OR (t ~* 'lượt xem' AND t ~* 'dừng') THEN 'kenh-chet'
    WHEN t ~* 'cảnh báo' THEN 'canh-bao-tk'
    WHEN t ~* 'cần ≥ ?3' THEN 'cach-3-gio'
    WHEN t ~* 'đủ trần|trần ' THEN 'tran-ngay'
    WHEN t ~* 'ngoài khung' THEN 'ngoai-khung'
    WHEN t ~* 'chưa tới giờ' THEN 'chua-toi-gio'
    WHEN t ~* 'thử lại sau|nghỉ tới mai|hỏng [0-9]+ lần' THEN 'cho-sau-hong'
    WHEN t ~* 'lượt khác' THEN 'luot-khac-chay'
    WHEN t ~* 'bài thường' THEN 'bai-thuong'
    WHEN t ~* 'đăng từ (iMac|MacBook|Nguyens|Tuans)' THEN 'may-mac-khac'
    WHEN t ~* 'Graph API' AND t ~* 'bỏ lượt' THEN 'graph-xac-minh'
    WHEN t ~* 'Lên lịch [0-9]+/[0-9]+' THEN 'hen-thieu'
    WHEN t ~* 'dang-fb-reel|dang-dailymotion' THEN 'api-box3'
    WHEN t ~* 'ENOSPC|no space left' THEN 'het-dia'
    WHEN t ~* 'curl .*-o ' THEN 'tai-tep-hong'
    WHEN t ~* 'nut-nhay-cam' THEN 'br-chan-nut'
    WHEN t ~* 'br eval|SyntaxError' THEN 'br-eval-hong'
    WHEN t ~* 'Facebook hẹn giờ' THEN 'fb-hen-gio'
    WHEN t ~* 'chưa công khai|oembed' THEN 'yt-chua-cong-khai'
    WHEN t ~* 'Quora' THEN 'quora-giao-dien'
    WHEN t ~* 'Instagram' THEN 'ig-giao-dien'
    WHEN t ~* 'TikTok' THEN 'tiktok-giao-dien'
    WHEN t ~* 'nút Post|0/[0-9]+ ảnh' THEN 'x-giao-dien'
    WHEN t ~* 'terminated' THEN 'tien-trinh-bi-cat'
    WHEN t ~* 'điền không đủ' THEN 'yt-dien-thieu'
    WHEN t ~* 'Public|Visibility' THEN 'yt-khong-public'
    WHEN t ~* 'Video published|bấm Publish' THEN 'yt-publish-khong-xac-nhan'
    WHEN t ~* 'kênh khác|không đứng ở tài khoản|sai kênh|danh tính' THEN 'sai-danh-tinh'
    WHEN t ~* 'playlist' THEN 'yt-playlist'
    WHEN t ~* 'chưa thấy bài mới' THEN 'x-khong-thay-bai'
    WHEN t ~* 'ô soạn' THEN 'x-o-soan'
    WHEN t ~* 'chưa tải xong|tải lên' THEN 'tai-len-cham'
    WHEN t ~* 'không kết nối được|ssh' THEN 'ssh-may-khac'
    WHEN t ~* 'br use|profile|cần mở' THEN 'br-profile'
    WHEN t ~* 'Graph|OAuth|access token|\(#[0-9]+\)' THEN 'fb-graph'
    WHEN t ~* 'đăng nhập|login|checkpoint' THEN 'dang-nhap'
    WHEN t ~* 'không đăng lại' THEN 'dang-trung'
    WHEN t ~* 'bản xuất' THEN 'thieu-ban-xuat'
    WHEN t ~* 'chưa xác nhận|không xác nhận' THEN 'chua-xac-nhan'
    WHEN t ~* 'mất dấu' THEN 'mat-dau'
    WHEN t ~* 'timed out|ETIMEDOUT|timeout|quá [0-9]+ ?s' THEN 'qua-gio'
    ELSE 'khac' END
$$;

CREATE TABLE IF NOT EXISTS may_dang_so (
  id bigserial PRIMARY KEY,
  ma text NOT NULL,                       -- máy studio (xv_may.ma)
  nen text NOT NULL,                      -- nơi đăng (youtube, facebook:632, x_anh…)
  du_an text NOT NULL DEFAULT '',         -- xv_may.du_an lúc ghi (lọc + phân quyền theo dự án)
  may_mac text NOT NULL DEFAULT '',       -- iMac | MacBook
  bd timestamptz NOT NULL,                -- lượt bắt đầu
  kt timestamptz,                         -- lượt kết thúc
  giay numeric,
  ket text NOT NULL,                      -- dang (đã lên) · hen (đã hẹn giờ) · hong · dung (dừng đúng luật) · bo (bỏ lượt) · het (kho cạn)
  buoc_dung text,                         -- kenh · nhip · chon · chuan_bi · dang · xac_nhan · sau (null khi đi hết)
  ma_ly text,                             -- may_dang_ma_ly(loi) — nhóm để thống kê
  loi text,                               -- chữ đầy đủ máy nói ở bước dừng
  slug text, url text, acct text, profile text, duong text,   -- duong: api | br | br@<máy Mac khác>
  buoc jsonb NOT NULL DEFAULT '{}'::jsonb,                   -- { kenh: { t: ok|loi|dung|bo, ly, ms }, … }
  lan integer NOT NULL DEFAULT 1,         -- lượt dừng/bỏ/cạn cùng lý do liền nhau trong ngày gộp một dòng
  nguon text NOT NULL DEFAULT 'may',      -- may (máy ghi đủ bước) | nhat_ky (nạp lại từ xv_may_nhat_ky cũ, chỉ có bước đã biết)
  ghi_chu jsonb NOT NULL DEFAULT '[]'::jsonb                 -- [{ ai, luc, chu }]
);
CREATE INDEX IF NOT EXISTS may_dang_so_bd_idx ON may_dang_so (bd DESC);
CREATE INDEX IF NOT EXISTS may_dang_so_kenh_idx ON may_dang_so (ma, nen, bd DESC);
CREATE INDEX IF NOT EXISTS may_dang_so_ma_ly_idx ON may_dang_so (ma_ly, bd DESC);

-- LỆNH TỪ TRANG CHO MÁY Ở iMAC (thứ máy không đọc được từ DB: sổ hỏng ~/.cache/so-hong.json trên iMac). dang-lien-tuc đọc đầu mỗi vòng, áp, ghi xong_luc.
CREATE TABLE IF NOT EXISTS may_dang_lenh (
  id bigserial PRIMARY KEY,
  loai text NOT NULL CHECK (loai IN ('thu_lai')),
  ma text NOT NULL, nen text NOT NULL,
  luot_id bigint,
  boi text NOT NULL DEFAULT '',
  luc timestamptz NOT NULL DEFAULT now(),
  xong_luc timestamptz, ket text
);
CREATE INDEX IF NOT EXISTS may_dang_lenh_cho_idx ON may_dang_lenh (luc) WHERE xong_luc IS NULL;

-- NẠP LẠI 14 NGÀY từ nhật ký cũ (chỉ khi sổ còn trống) để tab có số thống kê ngay — bước nào nhật ký không ghi thì để trống.
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM may_dang_so) THEN
  -- (a) lượt đăng thật: 'bat-dau' → sự kiện kết quả đầu tiên cùng máy × nền trong 90 phút
  INSERT INTO may_dang_so (ma, nen, du_an, bd, kt, giay, ket, buoc_dung, ma_ly, loi, slug, url, buoc, nguon)
  SELECT m.ma, b.nen, m.du_an, b.luc, e.luc, extract(epoch FROM e.luc - b.luc),
    CASE WHEN e.ok THEN 'dang' ELSE 'hong' END, CASE WHEN e.ok THEN NULL ELSE 'dang' END,
    CASE WHEN e.ok THEN NULL ELSE may_dang_ma_ly(e.noi_dung) END, CASE WHEN e.ok THEN NULL ELSE e.noi_dung END,
    coalesce(e.slug, b.slug), e.url,
    jsonb_build_object('kenh', jsonb_build_object('t', 'ok'), 'nhip', jsonb_build_object('t', 'ok'), 'chon', jsonb_build_object('t', 'ok', 'ly', coalesce(e.slug, b.slug)),
      'dang', jsonb_build_object('t', CASE WHEN e.ok THEN 'ok' ELSE 'loi' END, 'ly', e.noi_dung))
      || CASE WHEN e.ok THEN jsonb_build_object('xac_nhan', jsonb_build_object('t', CASE WHEN e.url IS NULL THEN 'loi' ELSE 'ok' END, 'ly', coalesce(e.url, 'không có link'))) ELSE '{}'::jsonb END,
    'nhat_ky'
  FROM xv_may_nhat_ky b JOIN xv_may m ON m.id = b.may_id
  JOIN LATERAL (SELECT * FROM xv_may_nhat_ky e WHERE e.may_id = b.may_id AND e.nen IS NOT DISTINCT FROM b.nen AND e.buoc = 'dang' AND e.luc >= b.luc AND e.luc < b.luc + interval '90 minutes'
    AND (e.noi_dung LIKE 'Đã đăng%' OR (NOT e.ok AND e.noi_dung NOT LIKE 'Hết video%')) ORDER BY e.luc LIMIT 1) e ON true
  WHERE b.buoc = 'bat-dau' AND b.luc > now() - interval '14 days' AND b.nen IS NOT NULL;
  -- (b) hỏng không có 'bat-dau' (nhánh profile ghim máy khác, playlist sau đăng)
  INSERT INTO may_dang_so (ma, nen, du_an, bd, kt, ket, buoc_dung, ma_ly, loi, slug, buoc, nguon)
  SELECT m.ma, e.nen, m.du_an, e.luc, e.luc, 'hong', CASE WHEN e.noi_dung ~* 'playlist' THEN 'sau' ELSE 'dang' END, may_dang_ma_ly(e.noi_dung), e.noi_dung, e.slug,
    jsonb_build_object(CASE WHEN e.noi_dung ~* 'playlist' THEN 'sau' ELSE 'dang' END, jsonb_build_object('t', 'loi', 'ly', e.noi_dung)), 'nhat_ky'
  FROM xv_may_nhat_ky e JOIN xv_may m ON m.id = e.may_id
  WHERE e.buoc = 'dang' AND NOT e.ok AND e.noi_dung NOT LIKE 'Hết video%' AND e.luc > now() - interval '14 days' AND e.nen IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM may_dang_so s WHERE s.ma = m.ma AND s.nen = e.nen AND s.kt = e.luc);
  -- (c) kho cạn / dừng đúng luật: gộp theo máy × nền × ngày (giờ VN) × lý do → một dòng, lan = số lần
  INSERT INTO may_dang_so (ma, nen, du_an, bd, kt, ket, buoc_dung, ma_ly, loi, buoc, lan, nguon)
  SELECT m.ma, e.nen, m.du_an, min(e.luc), max(e.luc),
    CASE WHEN e.buoc = 'dang' THEN 'het' ELSE 'dung' END,
    CASE WHEN e.buoc = 'dang' THEN 'chon' WHEN e.buoc = 'dung' OR min(e.noi_dung) ~* 'kênh hẹn giờ|nghỉ tới' THEN 'kenh' ELSE 'nhip' END,
    may_dang_ma_ly(min(e.noi_dung)), min(e.noi_dung),
    CASE WHEN e.buoc = 'dang' THEN jsonb_build_object('kenh', jsonb_build_object('t', 'ok'), 'nhip', jsonb_build_object('t', 'ok'), 'chon', jsonb_build_object('t', 'loi', 'ly', min(e.noi_dung)))
      ELSE jsonb_build_object(CASE WHEN e.buoc = 'dung' OR min(e.noi_dung) ~* 'kênh hẹn giờ|nghỉ tới' THEN 'kenh' ELSE 'nhip' END, jsonb_build_object('t', 'dung', 'ly', min(e.noi_dung))) END,
    count(*), 'nhat_ky'
  FROM xv_may_nhat_ky e JOIN xv_may m ON m.id = e.may_id
  WHERE e.luc > now() - interval '14 days' AND e.nen IS NOT NULL
    AND ((e.buoc = 'dang' AND e.noi_dung LIKE 'Hết video%') OR e.buoc IN ('nghi', 'dung'))
  GROUP BY m.ma, e.nen, m.du_an, e.buoc, (e.luc AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, regexp_replace(e.noi_dung, '[0-9]+([.,][0-9]+)?', 'N', 'g');
END IF; END $$;
