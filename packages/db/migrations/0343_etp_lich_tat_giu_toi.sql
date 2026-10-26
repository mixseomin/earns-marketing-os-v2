-- GIỮ TẮT TỚI MỐC (anh 26/10/2026 18h: "các camp tao thử bật lúc 16h30 giờ tắt đi chưa? để đến 8h bật lại theo lịch"): camp trong sổ lịch có giu_toi
-- thì apps/etp/lich-gio.py KHÔNG bật lại trước mốc đó, kể cả khi khung đang BẬT (20h–06h) hay công tắc lịch tắt. Tới mốc → bật theo lịch như thường.
ALTER TABLE etp.lich_tat ADD COLUMN IF NOT EXISTS giu_toi timestamptz;
