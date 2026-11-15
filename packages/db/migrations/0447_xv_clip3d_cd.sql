-- Clip 3D ghi chuyển động máy lúc xuất (khung_xam.clip.cd) — kieu.ts › clip3dMoi so cd với ky_thuat.chuyen_dong hiện tại (16/11/2026, phim #3071).
-- Clip cũ chưa có cd: 6 shot tập #3074 vừa đổi "đẩy vào" → máy đứng (luật nhịp hình: máy tiến cần ≥ 3 s) mang clip xuất lúc còn đẩy vào → ghi 'day_vao'
-- để chúng thành clip cũ, dựng lại. Mọi clip còn lại: chuyển động lúc xuất = chuyển động đang khai.
UPDATE xv_canh SET khung_xam = jsonb_set(khung_xam, '{clip,cd}', '"day_vao"')
 WHERE id IN (9195, 9196, 9210, 9212, 9201, 9204) AND khung_xam ? 'clip' AND NOT (khung_xam->'clip' ? 'cd');
UPDATE xv_canh SET khung_xam = jsonb_set(khung_xam, '{clip,cd}', to_jsonb(coalesce(nullif(ky_thuat->>'chuyen_dong', ''), 'tinh')))
 WHERE khung_xam ? 'clip' AND jsonb_typeof(khung_xam->'clip') = 'object' AND NOT (khung_xam->'clip' ? 'cd');
