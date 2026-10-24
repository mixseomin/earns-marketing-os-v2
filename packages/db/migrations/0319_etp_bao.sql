-- etp.on.tc (anh 24/10/2026 "báo trên etp nữa"): MÁY LUẬT ĐANG BÁO GÌ — cty ethopex.mjs ghi lại mỗi nhịp (thay toàn bộ) đúng các nhóm gửi Telegram:
-- tắt / bị từ chối / lãi đầu phiên / tăng bậc / giảm bậc / ROI tụt / T30 / đủ tiêu chí bid ROAS / camp bị đóng / lỗi máy. Trang etp đọc để hiện cùng nội dung.
CREATE TABLE IF NOT EXISTS etp.bao (
  nhom     text NOT NULL,
  camp_id  integer NOT NULL,
  chu      text NOT NULL,
  luc      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (nhom, camp_id)
);
