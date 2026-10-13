-- Bản dịch chữ màn theo ngôn ngữ của shot (ban-dich.ts): { "<ngôn ngữ>": { goc: chữ màn lúc dịch, chu: bản dịch } } — goc lệch chữ màn hiện tại
-- = bản dịch cũ, không dùng. Câu thoại dịch nằm ngay trong từng dòng thoai[i].dich.
ALTER TABLE xv_canh ADD COLUMN IF NOT EXISTS chu_man_dich jsonb NOT NULL DEFAULT '{}'::jsonb;
