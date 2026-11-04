-- TẠM BỎ CƠ CHẾ NHẬN PHIM (anh 04/11/2026: "tạm bỏ cơ chế nhận phim vì giờ chỉ có mình tao chạy. Nên khi chọn phim, mày phải chạy đủ các bước, kể cả phân tích loại phim, nhóm gốc"):
-- nhan_bat_buoc = false → nhan-ban.py không đòi "phim mới phải nhận", dòng phim không ghi / không kiểm etp.phim_nhan. Bật lại: update … set gia_tri = 'true'.
insert into etp.cau_hinh (khoa, gia_tri, ghi, ai) values ('nhan_bat_buoc', 'false'::jsonb, 'phim mới phải Nhận trước khi lên camp (false = tạm bỏ, chỉ anh chạy)', 'anh (chat 04/11/2026)')
  on conflict (khoa) do update set gia_tri = excluded.gia_tri, ghi = excluded.ghi, ai = excluded.ai;
