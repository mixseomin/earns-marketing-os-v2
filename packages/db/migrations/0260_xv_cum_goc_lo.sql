-- Kho creative theo sản phẩm (apps/xuong-video/src/lib/xuong-video/kho-creative.ts).
-- xv_cum_goc: CỤM NGƯỜI MUA của một nhóm sản phẩm spy — các góc nói cùng một ý (đùi to / chật đùi / dáng cong…) gom một cụm,
--   khỏi làm nhiều creative nói một điều. Một dòng mỗi nhóm spy; nguon = ai gom, lúc nào (scripts/cum-goc.mts ghi).
-- xv_lo: LÔ SINH — kế hoạch creative (một ô góc × khuôn) trước khi thành phim; tạo phim từ template thì gắn phim_id.
CREATE TABLE IF NOT EXISTS xv_cum_goc (
  sp integer PRIMARY KEY,
  cum jsonb NOT NULL DEFAULT '[]'::jsonb,
  nguon text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS xv_lo (
  id serial PRIMARY KEY,
  sp_key text NOT NULL,
  goc jsonb NOT NULL DEFAULT '[]'::jsonb,
  dong text NOT NULL DEFAULT '',
  khuon text NOT NULL DEFAULT '',
  template_id integer,
  phim_id integer,
  trang_thai text NOT NULL DEFAULT 'cho',   -- cho (kế hoạch) · da_tao (đã thành phim) · bo (bỏ — không xoá dòng)
  ghi_chu text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS xv_lo_sp_key ON xv_lo (sp_key);
