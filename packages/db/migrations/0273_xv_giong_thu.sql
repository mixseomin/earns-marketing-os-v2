-- GIỌNG ĐÃ THỬ của nhân vật (anh 17/10/2026, tập mẫu tổng tài: "lưu cả các giọng lại, lát ta chọn lại trên studio"): mỗi lượt thử / nghe
-- thử giọng thêm một dòng { model, voice, url, cau, luc } — chọn lại giọng cũ trên thẻ nhân vật không phải sinh lại (apps/xuong-video hoan-tat.ts › hoanTatAm).
ALTER TABLE xv_nhan_vat ADD COLUMN IF NOT EXISTS giong_thu jsonb NOT NULL DEFAULT '[]'::jsonb;
