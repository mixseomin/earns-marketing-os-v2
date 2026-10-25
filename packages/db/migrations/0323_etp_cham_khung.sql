-- khung bị bắt từng tiêu chí: {"meta.cuong_ep": [12, 13]} — số khung 1–30 trên tờ khung (lop.anh.url), trang hiện viền đỏ + tua video (lop.anh.giay = độ dài)
ALTER TABLE etp.cham ADD COLUMN IF NOT EXISTS khung jsonb NOT NULL DEFAULT '{}';
