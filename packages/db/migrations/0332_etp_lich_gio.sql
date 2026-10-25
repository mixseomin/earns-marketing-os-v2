-- LỊCH GIỜ BẬT / TẮT CAMP THEO THỂ LOẠI PHIM (anh 25/10/2026: "Chốt kiểu này. Như vậy sẽ cần có bảng giờ on-off theo khung như trên ở etp để còn kiểm soát").
-- Số đo 21–24/10 (etp.so_gio × etp.phim.the_loai, giờ VN): 07h (ngân sách vừa nạp, Meta xả) và 13h–19h lỗ ở mọi thể loại trừ vô danh; 08h–12h và 20h–06h lãi.
-- Ai đọc: apps/etp/lich-gio.py (gọi đầu mỗi lượt dong-bo.py, 10 phút) — tạm dừng camp khi thể loại của nó vào khung TẮT, bật lại khi vào khung BẬT.
-- Ai ghi: bảng "Lịch giờ" ở etp.on.tc › Camp (lib/actions/etp-lich.ts). Công tắc tổng: etp.cau_hinh['lich_gio'] (false = bật lại hết, không tắt gì).
-- Khung (giờ VN): k07 = 07:00–07:59 · k08 = 08:00–12:59 · k13 = 13:00–19:59 · k20 = 20:00–06:59. '_khac' = phim chưa gắn thể loại.
CREATE TABLE IF NOT EXISTS etp.lich_gio (
  the_loai  text NOT NULL,
  khung     text NOT NULL CHECK (khung IN ('k07', 'k08', 'k13', 'k20')),
  bat       boolean NOT NULL,
  ai        text,
  luc       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (the_loai, khung)
);
-- camp ĐANG tạm dừng vì lịch — chỉ những camp này mới được máy bật lại (camp tắt vì lý do khác không bao giờ bị bật)
CREATE TABLE IF NOT EXISTS etp.lich_tat (
  camp_id   integer PRIMARY KEY,
  the_loai  text,
  khung     text,
  luc       timestamptz NOT NULL DEFAULT now()
);
INSERT INTO etp.lich_gio (the_loai, khung, bat, ai)
SELECT t, k, CASE WHEN t = 'vo_danh' THEN true ELSE k IN ('k08', 'k20') END, 'mặc định theo số 21–24/10'
FROM unnest(ARRAY['vo_danh', 'tinh_cam', 'fantasy', 'ty_phu', 'soi', 'hoi_han', 'he_thong', 'mafia', 'me_con', 'co_trang', 'vien_tuong', 'doi_thuong', 'hoc_duong', '_khac']) t,
     unnest(ARRAY['k07', 'k08', 'k13', 'k20']) k
ON CONFLICT DO NOTHING;
INSERT INTO etp.cau_hinh (khoa, gia_tri, ghi, ai) VALUES ('lich_gio', 'true', 'bật / tắt camp theo lịch giờ thể loại (etp.lich_gio) — false: máy bật lại mọi camp đang tạm dừng vì lịch và không tắt thêm', 'anh 25/10/2026')
ON CONFLICT (khoa) DO NOTHING;
