-- KEYFRAME KẾT (14/10/2026): khung CUỐI của shot, sinh từ khung màu 3D ở chỗ kết (may_3d.vi_tri[].den) — video nhận ảnh đầu + ảnh cuối,
-- nhân vật đi đúng từ chỗ mở tới chỗ kết của bản 3D thay vì tự bịa đường đi.
ALTER TABLE xv_canh ADD COLUMN IF NOT EXISTS keyframe_ket text;
