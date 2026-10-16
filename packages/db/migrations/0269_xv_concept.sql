-- KHO CREATIVE THEO CONCEPT (anh 16–17/10/2026: "1.000 creative — quản lý trong studio trước khi sản xuất"; apps/xuong-video/src/lib/xuong-video/concept.ts).
-- Concept = một sub-avatar của spy (path × mức nhận biết), nhập từ spy.on.tc /api/goc/avatar. Cặp = concept × template (cách tiếp cận).
-- Biến thể hình = diễn viên / bối cảnh của một cặp (V1 gốc, V2…): đổi = sinh lại keyframe + video các shot có người / bối cảnh đó.
-- Phương án = nhiều giá trị chữ cho một ô câu chuyện của template ({{noi_dau}}, {{review}}…) — đổi chữ dùng lại clip.
-- Creative = một tổ hợp ĐÃ DUYỆT (cặp × biến thể × một phương án mỗi ô), số thứ tự cố định trong sản phẩm; tổ hợp chưa duyệt chỉ tính ra, không lưu.
-- Không xoá dòng: bỏ = an / trang_thai 'bo' (luật cấm xoá dữ liệu).
CREATE TABLE IF NOT EXISTS xv_concept (
  id serial PRIMARY KEY,
  sp_key text NOT NULL,
  spy_sp integer NOT NULL,
  ma text NOT NULL,
  path text NOT NULL DEFAULT '',
  path_ten text NOT NULL DEFAULT '',
  nb text NOT NULL DEFAULT '',
  ten text NOT NULL DEFAULT '',
  du_lieu jsonb NOT NULL DEFAULT '{}'::jsonb,
  an boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sp_key, spy_sp, ma)
);
CREATE TABLE IF NOT EXISTS xv_cap (
  id serial PRIMARY KEY,
  concept_id integer NOT NULL REFERENCES xv_concept(id),
  template_id integer NOT NULL,
  bat boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (concept_id, template_id)
);
CREATE TABLE IF NOT EXISTS xv_bien_the_hinh (
  id serial PRIMARY KEY,
  cap_id integer NOT NULL REFERENCES xv_cap(id),
  so integer NOT NULL,
  nguoi_chinh text NOT NULL DEFAULT '',
  nguoi_phu text NOT NULL DEFAULT '',
  boi_canh text NOT NULL DEFAULT '',
  goc boolean NOT NULL DEFAULT false,
  an boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cap_id, so)
);
CREATE TABLE IF NOT EXISTS xv_phuong_an (
  id serial PRIMARY KEY,
  cap_id integer NOT NULL REFERENCES xv_cap(id),
  o text NOT NULL,
  so integer NOT NULL,
  chu text NOT NULL DEFAULT '',
  nguon text NOT NULL DEFAULT '',
  an boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cap_id, o, so)
);
CREATE TABLE IF NOT EXISTS xv_creative (
  id serial PRIMARY KEY,
  sp_key text NOT NULL,
  so integer NOT NULL,
  cap_id integer NOT NULL REFERENCES xv_cap(id),
  bien_the_id integer REFERENCES xv_bien_the_hinh(id),
  chon jsonb NOT NULL DEFAULT '{}'::jsonb,   -- {ô: số phương án}
  ma text NOT NULL,                          -- mã QC (tên quảng cáo) — quy kết quả về đúng từng mảnh
  trang_thai text NOT NULL DEFAULT 'duyet',  -- duyet · da_tao (đã thành phim) · bo
  phim_id integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sp_key, so),
  UNIQUE (sp_key, ma)
);
CREATE INDEX IF NOT EXISTS xv_concept_sp ON xv_concept (sp_key);
CREATE INDEX IF NOT EXISTS xv_creative_sp ON xv_creative (sp_key);
