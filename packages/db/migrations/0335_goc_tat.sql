-- GÓC TẮT theo tài sản (anh 25/10/2026: "cần thêm 1 tab/page quản lý danh sách góc của từng social assets"): góc spy anh tắt cho một máy
-- (thương hiệu) thì kế hoạch góc hằng tuần không xếp góc đó nữa. Bật lại = xoá dòng tắt (dòng cấu hình, không phải dữ liệu đo).
CREATE TABLE IF NOT EXISTS goc_tat (
  may text NOT NULL,
  goc_id integer NOT NULL,
  luc timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (may, goc_id)
);
