-- 🧩 Con bóc tách khung (anh 30/10/2026): thành phần THẬT đọc được từ keyframe đã sinh (đầu/cuối), để đối chiếu với dự kiến.
ALTER TABLE xv_canh ADD COLUMN IF NOT EXISTS boc_tach jsonb;
