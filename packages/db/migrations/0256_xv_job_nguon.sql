-- Nguồn của một lượt sinh (15/10/2026): cổng (ckey / ShopAIKey / Google…), model gọi, model thật phía sau, người bán, tiền VNĐ thật,
-- các bước đã thử trong chuỗi dự phòng — apps/xuong-video/src/lib/xuong-video/cong-ai.ts › NguonSinh.
ALTER TABLE xv_job ADD COLUMN IF NOT EXISTS nguon jsonb;
-- Báo hết tiền lên Telegram (MINE › Quản lý) — mỗi cổng tối đa một tin / 6 giờ.
CREATE TABLE IF NOT EXISTS xv_bao_het_tien (cong text PRIMARY KEY, luc timestamptz NOT NULL DEFAULT now(), lan int NOT NULL DEFAULT 1);
