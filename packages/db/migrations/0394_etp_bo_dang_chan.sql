-- BỘ 2 CHỈ LÊN CẢNH CUỐI (anh 01/11/2026 "bộ tk 2 đang lỗ khá nặng, giải pháp là gì" → chọn "Bộ 2 chỉ lên cảnh cuối"):
-- đo 29–31/10 trên bộ 2: cảnh cuối ROI −6% (346 camp) · cảnh thật −38% (43) · kể chuyện −38% (40). Camp MỚI (nhan-ban --creative) ở bộ có trong sổ này
-- mà creative mang dạng bị chặn thì không lên; clone camp đã thắng không đụng. Sửa sổ = sửa luật, không sửa mã.
insert into etp.cau_hinh (khoa, gia_tri, ghi, ai) values ('bo_dang_chan', '{"2": ["cảnh thật", "kể chuyện"]}'::jsonb,
  'bộ tài khoản → các dạng creative KHÔNG lên camp mới ở bộ đó (nhan-ban.py --creative)', 'anh (chat 01/11/2026)')
  on conflict (khoa) do update set gia_tri = excluded.gia_tri, ghi = excluded.ghi, ai = excluded.ai, luc = now();
