-- BỘ 2 CHỈ CHẠY PHIM ĐÃ LÃI (anh 02/11/2026 "bộ 2 vẫn âm thế nhỉ" → chọn "chặn mở camp phim mới" + "luật máy: tắt theo phim"):
-- đo 26/10–01/11 bộ 2: 160 phim, 13 phim lãi (+$92), 147 phim lỗ (−$599 trên $1.782 chi). Sửa sổ = sửa luật, không sửa mã.
insert into etp.cau_hinh (khoa, gia_tri, ghi, ai) values
  ('bo_chi_phim_lai', '["2"]'::jsonb, 'bộ chỉ mở camp mới / clone / thang cho phim đã lãi 7 ngày đã khép Ở BỘ ĐÓ (nhan-ban.py) — phim mới, phim lỗ không mở', 'anh (chat 02/11/2026)'),
  ('bo_tat_phim_lo', '["2"]'::jsonb, 'bộ áp luật PL: phim 7 ngày ở bộ đó chi ≥ $10, ROI < −20% → máy tắt camp ≤ $3 của phim, trừ camp tự lãi 3 ngày (luat-ethopex.py)', 'anh (chat 02/11/2026)')
  on conflict (khoa) do update set gia_tri = excluded.gia_tri, ghi = excluded.ghi, ai = excluded.ai, luc = now();
