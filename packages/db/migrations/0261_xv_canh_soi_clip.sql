-- Máy soi clip sau khi sinh (apps/xuong-video/src/lib/xuong-video/soi-clip.ts): chữ lạ model tự in + sản phẩm còn trong khung.
-- { url, luc, loi[], do: { mau[], chu[] }, bo_qua } — url = clip đã soi (đổi clip thì kết quả cũ không còn áp); bo_qua = người duyệt chấp nhận.
ALTER TABLE xv_canh ADD COLUMN IF NOT EXISTS soi_clip jsonb;
