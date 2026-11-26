-- creative đã xoá tệp khỏi kho R2 kho/ethopex (camp tắt hết + tạo trước 20/11, anh 26/11/2026) — cửa API ethopex_api.cua chặn lên camp mới bằng creative này (Meta tải lại URL → 404)
CREATE TABLE IF NOT EXISTS etp.kho_xoa (
  creative_id integer PRIMARY KEY,
  luc timestamptz NOT NULL DEFAULT now(),
  ly text
);
