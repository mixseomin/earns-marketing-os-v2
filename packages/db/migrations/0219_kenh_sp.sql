-- KÊNH KÉO KHÁCH theo sản phẩm (anh yêu cầu 05/10/2026: sản phẩm Gumroad/Etsy/KDP có marketing bên ngoài — ghim Pinterest,
-- video ngắn, trang tặng miễn phí — cần thấy mỗi kênh đang tới khâu nào). Một dòng = một sản phẩm × một kênh.
-- MÁY ghi (script của repo sản phẩm, vd puzzle-books/scripts/kenh.mjs), không ghi tay; tab Tài sản đọc.
CREATE TABLE IF NOT EXISTS kenh_sp (
  san_pham  text NOT NULL,            -- khoá ổn định: '<repo>:<ten>', vd 'puzzle-books:christmas'
  kenh      text NOT NULL,            -- pinterest | shorts | printables | …
  ten       text NOT NULL,            -- tên hiển thị của sản phẩm
  khop      text,                     -- chuỗi con của tên listing trên sàn (Etsy/KDP/Gumroad) để nối sang trạng thái bán
  muc       smallint NOT NULL DEFAULT 0,  -- khâu hiện tại, chỉ số trong bảng khâu của kênh (lib/tai-san/kenh.ts)
  xong      int,                      -- đã làm / tổng (ghim đã hẹn, video đã đăng…)
  tong      int,
  dich      text,                     -- link đích kênh đang trỏ về
  canh_bao  text,
  the_id    int,                      -- card board (human_tasks.id) đang lo việc kế của kênh này
  project   text,                     -- project của card, để mở /p/<project>/plays?task=<id>
  cap_nhat  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (san_pham, kenh)
);
