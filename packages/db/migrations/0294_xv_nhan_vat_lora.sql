-- LoRA của nhân vật (anh 18/10/2026): mặt nhân vật dạy sẵn vào một LoRA (fal flux-lora-fast-training) — keyframe vẽ một lượt bằng độ sâu 3D + LoRA,
-- không bước sửa mặt. { url, trigger, bo_hoc, so_anh, luc }
ALTER TABLE xv_nhan_vat ADD COLUMN IF NOT EXISTS lora jsonb;
