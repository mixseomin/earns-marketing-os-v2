-- TRẦN CAMP TRÙNG ĐOẠN = ĐIỂM BÃO HOÀ (anh 28/10/2026: "ko nhất thiết phải cắt bản mới và ko set tối đa 3 camp mỗi đoạn nữa vì có rule tắt và giảm bậc rồi.
-- Tuy nhiên tìm điểm bão hoà hợp lý để set max camp trùng"). Đo 22–27/10 trên creative thắng (nhà + team): bản 1–20 ROI +58…+72%, ~$30/camp;
-- bản 21–30 chỉ tiêu $13/camp, 31+ $5 / ROI +28% → trần 20. nhan-ban.py (clone giữ nguyên creative tới trần) + thay-tu-choi.py --don-doan đọc khoá này.
insert into etp.cau_hinh (khoa, gia_tri, ghi, ai) values ('tran_trung', '20'::jsonb, 'trần camp chạy cùng một đoạn creative (điểm bão hoà đo 22–27/10)', 'anh (chat 28/10/2026)')
  on conflict (khoa) do update set gia_tri = excluded.gia_tri, ghi = excluded.ghi, ai = excluded.ai, luc = now();
