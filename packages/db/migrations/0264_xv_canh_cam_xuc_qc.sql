-- MURCH CHO QC (anh 16/10/2026: "video ad nặng về cảm xúc phải khớp"): kế hoạch biểu cảm nhân vật từng shot (đầu → cuối, cấm), shot nối liền shot trước
-- (khung đầu = khung cuối clip trước), và kết quả SOÁT thật trên keyframe / clip (Claude trong phiên) — xem apps/xuong-video/src/lib/xuong-video/qc-cam-xuc.ts.
ALTER TABLE xv_canh ADD COLUMN IF NOT EXISTS bieu_cam jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE xv_canh ADD COLUMN IF NOT EXISTS noi_lien boolean NOT NULL DEFAULT false;
ALTER TABLE xv_canh ADD COLUMN IF NOT EXISTS soat jsonb;
