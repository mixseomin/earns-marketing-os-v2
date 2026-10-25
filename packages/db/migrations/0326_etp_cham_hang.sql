-- HÀNG CHỜ CHẤM CREATIVE (anh 25/10/2026: "thêm nút để tao có thể chủ động chạy chấm 1 creative cụ thể" + "các creative mới từ giờ có bước chấm tự động").
-- Ai ghi: nút "Chấm" trên etp.on.tc (lib/actions/etp-cham.ts, nguon = 'nut') · len-creative.py khi đẩy creative mới (nguon = 'moi').
-- Ai đọc: tiến trình iMac com.htuan.ethopex-cham (mỗi phút) → cham-creative.py hang. CHỈ CHẤM — không áp vào camp / luật.
CREATE TABLE IF NOT EXISTS etp.cham_hang (
  creative_id  integer PRIMARY KEY,
  luc          timestamptz NOT NULL DEFAULT now(),   -- lúc xếp hàng
  nguon        text NOT NULL,                        -- nut | moi
  ai           text,                                 -- người bấm (email) hoặc máy
  trang_thai   text NOT NULL DEFAULT 'cho',          -- cho | dang | xong | loi
  bat_dau      timestamptz,
  xong         timestamptz,
  loi          text
);
CREATE INDEX IF NOT EXISTS etp_cham_hang_tt ON etp.cham_hang (trang_thai, luc);
