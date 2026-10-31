-- THANG CHUYỂN HƯỚNG / CẤT PHIM (anh 31/10/2026: "sau nhiều lần thử mà ko có camp lãi, film lởm, thị trường… thì làm thế nào" → "Đc làm đi").
-- Chỉ phim CHƯA có camp nhà nào lãi. Máy apps/etp/cat_phim.py (thay-the.py gọi mỗi nhịp) ghi etp.phim.thu_vong:
--   null      đang thử bình thường (vòng 1: đổi creative theo dạng — thay-the.py)
--   'doi_bo'  chi thử ≥ cat_phim.chi mà ROI < cat_phim.roi, mới thử < cat_phim.so_bo bộ → camp thay kế tiếp lên bộ chưa thử (đổi thị trường)
--   'cat'     hết đường (đã thử đủ bộ hoặc chi ≥ cat_phim.chi_doi_bo) và team không lãi → cong.kiem chặn tạo / nhân bản / bật camp phim này
-- Mở lại tự động khi camp nhà hoặc team (14 ngày) lãi phim đó. Không xoá gì — camp còn chạy của phim cất vẫn để luật tắt xử như thường.
alter table etp.phim add column if not exists thu_vong text;
alter table etp.phim add column if not exists thu_ly text;
alter table etp.phim add column if not exists thu_luc timestamptz;
alter table etp.phim add column if not exists thu_bo text;   -- bộ đích của vòng đổi bộ (giữ cố định tới khi cất / mở lại)
insert into etp.cau_hinh (khoa, gia_tri, ghi, ai) values
  ('cat_phim', '{"chi": 25, "roi": -30, "chi_doi_bo": 50, "so_bo": 2, "bo": ["1", "2", "3"]}'::jsonb,
   'thang chuyển hướng phim chưa lãi: chi thử $ · ngưỡng ROI % · trần chi khi đổi bộ $ · số bộ thử · thứ tự bộ', 'anh chat 31/10/2026')
on conflict (khoa) do nothing;
