-- SỐ ĐO của phương pháp kéo khách theo ngày (anh hỏi 06/10/2026: "được bao nhiêu click, tương tác thế nào?").
-- Một dòng = một phương pháp × một tựa × một ngày đọc. Số là TỔNG máy đọc được ở nguồn tại ngày đó cho cửa sổ nguồn
-- đang mở (Pinterest trang thống kê ghim: 30 ngày gần nhất) — không phải số phát sinh riêng trong ngày; panel ghi rõ "30n".
-- Máy ghi qua /api/ext/kenh-so (playbook pinterest.doc-so-ghim, mỗi ngày); tab Tài sản đọc dòng mới nhất của từng ô.
CREATE TABLE IF NOT EXISTS kenh_so_ngay (
  kenh      text NOT NULL,            -- pinterest | shorts | printables | …  (= phuong_phap.key)
  san_pham  text NOT NULL,            -- = kenh_sp.san_pham ('puzzle-books:christmas')
  ngay      date NOT NULL,            -- ngày đọc
  hien      int  NOT NULL DEFAULT 0,  -- lượt hiện (impressions)
  tuong_tac int  NOT NULL DEFAULT 0,  -- tương tác tại nguồn (Pinterest: pin clicks + saves)
  click     int  NOT NULL DEFAULT 0,  -- click ra ngoài (outbound) — thứ đổi thành khách
  so_muc    int  NOT NULL DEFAULT 0,  -- số mục đã đọc (ghim / video / trang) gộp vào dòng này
  chi_tiet  jsonb,                    -- từng mục: [{id, ten, hien, click, …}] để tra ghim nào kéo được
  nguon     text NOT NULL DEFAULT '', -- 'pinterest-pin-stats' …
  cap_nhat  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kenh, san_pham, ngay)
);
