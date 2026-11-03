-- PLAN MỞ RỘNG CAMP THEO PHIM (anh 04/11/2026: "sao những film có lãi ổn lại ko thấy plan tăng creative? … áp dụng có cường độ. Film mới 5-6 camp lúc đầu,
-- gần đạt 30 thì còn ~1 camp mỗi lần thêm. Mỗi lần thêm phải đo kết quả tổng thể … tính con số lên camp mới phù hợp hiện trạng từng phim" ·
-- "các plan đó làm sao nhìn đc trên này tự động"). apps/etp/mo_rong.py (gọi trong dong-bo.py mỗi lượt) ghi; Cây camp etp.on.tc vẽ dòng mờ dưới phim.
create table if not exists etp.mo_rong (
  content_id integer primary key,
  n integer not null,            -- camp đang chạy (không tính ROAS ★)
  chi3 numeric, lai3 numeric, roi3 integer,   -- 3 ngày Ethopex đã khép
  roi_truoc integer,             -- ROI 3 ngày khép liền trước đó (đo lượt thêm trước có kéo tụt phim không)
  k integer not null,            -- số camp mới nên lên lượt này
  san integer not null,          -- creative sạch (chấm đạt, chưa bị Meta từ chối) chưa có camp
  can_sx integer not null,       -- k − san → cần sản xuất (tab Sản xuất)
  trang_thai text not null,      -- them (nên thêm ngay) · cho_do (lượt trước chưa đủ 1 ngày khép) · giu (ROI tụt / hoà đủ) · khong (lỗ / chưa đủ số / đủ 30)
  ly text,
  luc timestamptz not null default now()
);
