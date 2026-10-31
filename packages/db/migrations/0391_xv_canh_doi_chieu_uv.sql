-- ĐỐI CHIẾU THEO TỪNG ẢNH: mọi ảnh keyframe sinh ra (cả ứng viên) được bóc tách + so với phiếu shot; lưu theo url để biết ảnh nào lệch gì
-- (doi-chieu-anh.ts). boc_tach vẫn là bản của ảnh ĐANG CHỌN.
ALTER TABLE xv_canh ADD COLUMN IF NOT EXISTS doi_chieu_uv jsonb NOT NULL DEFAULT '{}'::jsonb;
