-- Mọi phiên bản video của một cảnh đều giữ lại (anh yêu cầu 08/10/2026): [{url, ban: nhap|cuoi, model, job, luc}] — chọn bản nào làm
-- nháp/bản cuối đang dùng mà không phải sinh lại.
ALTER TABLE xv_canh ADD COLUMN IF NOT EXISTS video_phien_ban jsonb NOT NULL DEFAULT '[]'::jsonb;
-- Gắn clip Kling 3s Claude sinh thử 08/10/2026 (từ keyframe cảnh 1) làm bản nháp cảnh 1 thay vì để phí; ghi tiền vào sổ.
INSERT INTO xv_job (phim_id, nhan, canh_id, loai, provider, model, trang_thai, output_url, chi_phi_cents, request)
SELECT t.phim_id, 'Video nháp · cảnh #1 (Claude sinh thử, gắn lại)', c.id, 'video', 'fal', 'fal:fal-ai/kling-video/v3/pro/image-to-video', 'xong',
       'https://img.on.tc/xuong-video/thu/kling-1791470082198.mp4', 42, '{"giay":3,"ban":"nhap","gan_lai":true}'::jsonb
FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id
WHERE c.id = 1 AND c.keyframe_url LIKE 'https://img.on.tc/xuong-video/keyframe/1-%'
  AND NOT EXISTS (SELECT 1 FROM xv_job WHERE output_url = 'https://img.on.tc/xuong-video/thu/kling-1791470082198.mp4');
UPDATE xv_canh SET video_url = 'https://img.on.tc/xuong-video/thu/kling-1791470082198.mp4', trang_thai = 'xong', loi = '',
  video_phien_ban = video_phien_ban || '[{"url":"https://img.on.tc/xuong-video/thu/kling-1791470082198.mp4","ban":"nhap","model":"fal:fal-ai/kling-video/v3/pro/image-to-video","luc":"2026-10-08T14:35:00Z"}]'::jsonb,
  nguon_video = '{"model":"fal:fal-ai/kling-video/v3/pro/image-to-video","giay":3}'::jsonb
WHERE id = 1 AND video_url IS NULL AND keyframe_url LIKE 'https://img.on.tc/xuong-video/keyframe/1-%';
-- Các cảnh đã có video từ trước: đưa vào danh sách phiên bản.
UPDATE xv_canh SET video_phien_ban = jsonb_build_array(jsonb_build_object('url', video_url, 'ban', 'nhap'))
WHERE video_url IS NOT NULL AND video_phien_ban = '[]'::jsonb;
