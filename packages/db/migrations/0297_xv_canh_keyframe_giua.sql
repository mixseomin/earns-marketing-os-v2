-- Chuỗi ảnh cuối (apps/xuong-video sinh-video.ts › anhCuoiChuoi, 19/10/2026): ảnh thứ 2 gửi model video = ảnh KẾT thật đầy khung + dải 3 nhịp
-- (đầu → giữa → kết) ở mép trên; clip luôn hoà tan về ảnh đó ở ~0,5 giây cuối → máy dò lúc dải nhịp hiện và cắt.
-- keyframe_giua: keyframe GIỮA người thật (từ khung 3D giữa clip, mau_giua) — ô giữa của dải nhịp.
-- cat_cuoi_s: giây cắt cuối của clip đang dùng (trước lúc dải nhịp hiện) — bản xuất phát không vượt quá.
ALTER TABLE xv_canh ADD COLUMN IF NOT EXISTS keyframe_giua text;
ALTER TABLE xv_canh ADD COLUMN IF NOT EXISTS cat_cuoi_s real;
