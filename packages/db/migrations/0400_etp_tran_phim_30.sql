-- TRẦN 30 CAMP / PHIM — CHỈ TÀI KHOẢN NHÀ (anh 02/11/2026 "Set lại 30 cho mọi camp nhà"): trần đặt 20–22/10, bị bỏ 28/10 (b057aa10, anh bảo "nâng" mà máy bỏ hẳn).
-- Đo 01/11: Number One, Nobody (94344) 106 camp có chi (nhà 67 + Sơn 39), ROI cả hệ 68% (26/10) → 0%. Đếm camp ĐANG CHẠY của phim ở tài khoản nhà
-- (camp ROAS miễn); tài khoản team không áp (nhan-ban.py / luat-ethopex.py bỏ qua khi chạy cho người team). Chỉ chặn mở thêm, không tắt camp đang chạy.
insert into etp.cau_hinh (khoa, gia_tri, ghi, ai) values
  ('tran_phim', '30'::jsonb, 'trần camp ĐANG CHẠY mỗi phim ở tài khoản nhà (nhan-ban.py + luật NB); camp ROAS miễn; team không áp', 'anh (chat 02/11/2026)')
  on conflict (khoa) do update set gia_tri = excluded.gia_tri, ghi = excluded.ghi, ai = excluded.ai, luc = now();
